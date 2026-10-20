#!/usr/bin/env python3
"""
SignVision Production Inference Engine (`inference.py`)

Headless, thread-safe ISL recognition engine designed for direct integration
into existing FastAPI microservices, Flask/Django backends, or worker queues.

Features:
- Loads scikit-learn pipeline and MediaPipe Hand Landmarker once at startup.
- Supports predicting from:
    1. Video file path (mp4, webm, avi, mov)
    2. Video bytes in-memory (e.g. from FastAPI UploadFile)
    3. List of decoded OpenCV BGR numpy frames
    4. Pre-extracted landmark sequences (16 x 154 or 2464 dims)
- Configurable confidence thresholds and hand-coverage gating.
- Temporal smoothing helper (`RollingInferenceBuffer`) for streaming video chunks.
- Pure CPU execution (no GUI, no webcam loop, no OpenCV display windows).
"""

import os
import sys
import time
import json
import tempfile
from collections import deque, Counter
from typing import Dict, List, Optional, Tuple, Any, Union

import cv2
import numpy as np
import joblib

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from src.landmark_features import (
    HandLandmarkerExtractor,
    DEFAULT_NUM_FRAMES,
    FEATURE_DIM_PER_FRAME,
    TOTAL_CLIP_FEATURE_DIM,
)

DEFAULT_MODEL_PATH = os.path.join(CURRENT_DIR, "models", "sign_classifier.joblib")
DEFAULT_METADATA_PATH = os.path.join(CURRENT_DIR, "models", "model_metadata.json")
DEFAULT_TASK_PATH = os.path.join(CURRENT_DIR, "models", "hand_landmarker.task")


class SignVisionInferenceEngine:
    """
    Production inference engine for SignVision ISL classification.
    """

    def __init__(
        self,
        model_path: str = DEFAULT_MODEL_PATH,
        metadata_path: str = DEFAULT_METADATA_PATH,
        task_model_path: str = DEFAULT_TASK_PATH,
        default_threshold: float = 0.65,
        default_min_hand_coverage: float = 0.50,
    ):
        self.model_path = os.path.abspath(model_path)
        self.metadata_path = os.path.abspath(metadata_path)
        self.task_model_path = os.path.abspath(task_model_path)
        self.default_threshold = default_threshold
        self.default_min_hand_coverage = default_min_hand_coverage

        # Validate file existence
        for p, desc in [
            (self.model_path, "Model classifier file"),
            (self.metadata_path, "Model metadata JSON"),
            (self.task_model_path, "MediaPipe hand landmarker task asset"),
        ]:
            if not os.path.isfile(p):
                raise FileNotFoundError(f"{desc} not found at: {p}")

        # 1. Load trained classification pipeline
        self.pipeline = joblib.load(self.model_path)

        # 2. Load metadata configuration
        with open(self.metadata_path, "r", encoding="utf-8") as f:
            self.metadata: Dict[str, Any] = json.load(f)

        self.classes: List[str] = self.metadata.get("classes", [])
        self.id_to_class: Dict[str, str] = self.metadata.get(
            "id_to_class", {str(i): c for i, c in enumerate(self.classes)}
        )
        self.class_to_id: Dict[str, int] = self.metadata.get(
            "class_to_id", {c: i for i, c in enumerate(self.classes)}
        )
        self.sequence_length: int = self.metadata.get("sequence_length", DEFAULT_NUM_FRAMES)
        self.total_feature_dim: int = self.metadata.get("total_feature_dim", TOTAL_CLIP_FEATURE_DIM)

        # Resolve classifier classes order
        classifier = getattr(self.pipeline, "named_steps", {}).get("classifier", self.pipeline)
        self.classifier_classes = getattr(
            self.pipeline,
            "classes_",
            getattr(classifier, "classes_", list(range(len(self.classes)))),
        )

        # 3. Initialize MediaPipe HandLandmarker extractor
        self.extractor = HandLandmarkerExtractor(model_path=self.task_model_path, num_hands=2)

    def predict_video(
        self,
        video_path: str,
        threshold: Optional[float] = None,
        min_hand_coverage: Optional[float] = None,
        mirror_horizontal: bool = False,
        min_logit_margin: Optional[float] = None,
        min_motion_std: Optional[float] = None,
        max_duration_sec: Optional[float] = 3.5,
    ) -> Dict[str, Any]:
        """
        Accepts any video file path (.mp4, .webm, .avi, .mov), uniformly samples 16 frames,
        extracts landmark vectors, and returns structured class probabilities.
        """
        t_start = time.perf_counter()
        if not os.path.isfile(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")

        clip_vector, meta = self.extractor.extract_video_features(
            video_path,
            num_sampled_frames=self.sequence_length,
            mirror_horizontal=mirror_horizontal,
            max_duration_sec=max_duration_sec,
        )
        hand_coverage = meta.get("coverage_ratio", 0.0)
        total_frames = meta.get("total_frames_in_file", 0)

        return self._predict_from_feature_vector(
            clip_vector=clip_vector,
            hand_coverage=hand_coverage,
            total_frames=total_frames,
            threshold=threshold or self.default_threshold,
            min_hand_coverage=min_hand_coverage or self.default_min_hand_coverage,
            t_start=t_start,
            min_logit_margin=min_logit_margin if min_logit_margin is not None else 0.0,
            min_motion_std=min_motion_std if min_motion_std is not None else 0.0,
            temporal_info=meta,
        )

    def predict_video_bytes(
        self,
        video_bytes: bytes,
        file_extension: str = ".mp4",
        threshold: Optional[float] = None,
        min_hand_coverage: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Convenience method for FastAPI endpoints receiving in-memory file buffers.
        Writes bytes to a temporary file, processes it, and cleans up automatically.
        """
        if not video_bytes:
            raise ValueError("video_bytes cannot be empty.")

        suffix = file_extension if file_extension.startswith(".") else f".{file_extension}"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            tmp_path = tmp_file.name
            tmp_file.write(video_bytes)

        try:
            return self.predict_video(
                video_path=tmp_path,
                threshold=threshold,
                min_hand_coverage=min_hand_coverage,
            )
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    def predict_frames(
        self,
        frames: List[np.ndarray],
        threshold: Optional[float] = None,
        min_hand_coverage: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Accepts a list of OpenCV BGR frames in memory, uniformly samples 16 frames,
        extracts features, and executes inference.
        """
        t_start = time.perf_counter()
        num_frames = len(frames)
        if num_frames == 0:
            raise ValueError("frames list cannot be empty.")

        # Uniform sampling of 16 frames
        if num_frames >= self.sequence_length:
            indices = np.linspace(0, num_frames - 1, self.sequence_length, dtype=int)
        else:
            indices = list(range(num_frames))
            while len(indices) < self.sequence_length:
                indices.append(indices[-1])
            indices = np.array(indices[: self.sequence_length], dtype=int)

        sampled_frames = [frames[i] for i in indices]

        frame_vectors = []
        frames_with_hands = 0
        for f in sampled_frames:
            vec, stats = self.extractor.extract_frame_landmarks(f)
            frame_vectors.append(vec)
            if stats.get("hands_detected", 0) > 0:
                frames_with_hands += 1

        clip_vector = np.concatenate(frame_vectors).astype(np.float32)
        hand_coverage = float(frames_with_hands) / float(self.sequence_length)

        return self._predict_from_feature_vector(
            clip_vector=clip_vector,
            hand_coverage=hand_coverage,
            total_frames=num_frames,
            threshold=threshold or self.default_threshold,
            min_hand_coverage=min_hand_coverage or self.default_min_hand_coverage,
            t_start=t_start,
        )

    def predict_sequence(
        self,
        sequence: np.ndarray,
        threshold: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Accepts pre-extracted landmark vectors (e.g. client-side MediaPipe in React Native or Web).
        Shape can be (16, 154) or flattened (2464,).
        """
        t_start = time.perf_counter()
        arr = np.array(sequence, dtype=np.float32)

        if arr.ndim == 2:
            if arr.shape != (self.sequence_length, FEATURE_DIM_PER_FRAME):
                raise ValueError(
                    f"Expected 2D sequence shape ({self.sequence_length}, {FEATURE_DIM_PER_FRAME}), received {arr.shape}"
                )
            flat_vec = arr.flatten()
        elif arr.ndim == 1:
            if arr.shape[0] != self.total_feature_dim:
                raise ValueError(
                    f"Expected 1D vector length {self.total_feature_dim}, received {arr.shape[0]}"
                )
            flat_vec = arr
        else:
            raise ValueError(f"Invalid sequence dimensions: {arr.shape}")

        return self._predict_from_feature_vector(
            clip_vector=flat_vec,
            hand_coverage=1.0,
            total_frames=self.sequence_length,
            threshold=threshold or self.default_threshold,
            min_hand_coverage=0.0,
            t_start=t_start,
        )

    def _predict_from_feature_vector(
        self,
        clip_vector: np.ndarray,
        hand_coverage: float,
        total_frames: int,
        threshold: float,
        min_hand_coverage: float,
        t_start: float,
        min_logit_margin: float = 0.0,
        min_motion_std: float = 0.0,
        temporal_info: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Internal helper to execute classifier prediction and structure JSON outputs."""
        t_infer_start = time.perf_counter()
        prob_array = self.pipeline.predict_proba(clip_vector.reshape(1, -1))[0]
        infer_time_ms = (time.perf_counter() - t_infer_start) * 1000.0

        # Calculate decision function margin (logit distance between top class and second class)
        classifier = getattr(self.pipeline, "named_steps", {}).get("classifier", self.pipeline)
        scaler = getattr(self.pipeline, "named_steps", {}).get("scaler", None)
        logit_margin = 999.0
        if hasattr(classifier, "decision_function"):
            try:
                scaled_vec = scaler.transform(clip_vector.reshape(1, -1)) if scaler else clip_vector.reshape(1, -1)
                raw_logits = classifier.decision_function(scaled_vec)[0]
                sorted_logits = np.sort(raw_logits)
                if len(sorted_logits) > 1:
                    logit_margin = float(sorted_logits[-1] - sorted_logits[-2])
            except Exception:
                pass

        # Calculate dynamic wrist motion variance across 16 frames
        matrix = clip_vector.reshape(self.sequence_length, -1)
        left_motion = float(np.std(matrix[:, 1:4], axis=0).mean()) if matrix.shape[1] >= 4 else 0.0
        right_motion = float(np.std(matrix[:, 78:81], axis=0).mean()) if matrix.shape[1] >= 81 else 0.0
        max_motion = max(left_motion, right_motion)

        prob_dict: Dict[str, float] = {}
        for idx_in_array, class_idx in enumerate(self.classifier_classes):
            idx_str = str(int(class_idx))
            if idx_str in self.id_to_class:
                class_name = self.id_to_class[idx_str]
            elif int(class_idx) < len(self.classes):
                class_name = self.classes[int(class_idx)]
            else:
                class_name = f"Class_{class_idx}"
            prob_dict[class_name] = round(float(prob_array[idx_in_array]), 4)

        sorted_probs = sorted(prob_dict.items(), key=lambda item: item[1], reverse=True)
        top_sign, top_prob = sorted_probs[0]

        runner_up_class = sorted_probs[1][0] if len(sorted_probs) > 1 else None
        runner_up_prob = sorted_probs[1][1] if len(sorted_probs) > 1 else 0.0

        # Detailed rejection path instrumentation
        checks = {
            "hand_coverage": {
                "value": round(float(hand_coverage), 4),
                "threshold": round(float(min_hand_coverage), 4),
                "passed": bool(hand_coverage >= min_hand_coverage),
            },
            "temporal_window": {
                "value": total_frames,
                "threshold": self.sequence_length,
                "passed": bool(total_frames >= self.sequence_length),
            },
            "wrist_motion": {
                "value": round(float(max_motion), 4),
                "threshold": round(float(min_motion_std), 4),
                "passed": bool(min_motion_std <= 0.0 or max_motion >= min_motion_std),
            },
            "confidence": {
                "value": round(float(top_prob), 4),
                "threshold": round(float(threshold), 4),
                "passed": bool(top_prob >= threshold),
            },
            "decision_margin": {
                "value": round(float(logit_margin), 4),
                "threshold": round(float(min_logit_margin), 4),
                "passed": bool(min_logit_margin <= 0.0 or logit_margin >= min_logit_margin),
            },
        }

        if hand_coverage < min_hand_coverage:
            rejection_reason = "INSUFFICIENT_HAND_COVERAGE"
            pred_status = "UNCERTAIN"
            status_msg = f"Low hand detection coverage ({hand_coverage * 100:.1f}%)"
            final_sign = "UNCERTAIN"
        elif total_frames < self.sequence_length:
            rejection_reason = "INSUFFICIENT_TEMPORAL_WINDOW"
            pred_status = "UNCERTAIN"
            status_msg = f"Clip too short ({total_frames} frames < {self.sequence_length})"
            final_sign = "UNCERTAIN"
        elif min_motion_std > 0.0 and max_motion < min_motion_std:
            rejection_reason = "INSUFFICIENT_MOTION"
            pred_status = "UNCERTAIN"
            status_msg = f"Insufficient gesture movement ({max_motion:.3f}) - hands stationary"
            final_sign = "UNCERTAIN"
        elif top_prob < threshold:
            rejection_reason = "LOW_CLASSIFIER_CONFIDENCE"
            pred_status = "UNCERTAIN"
            status_msg = f"Low confidence ({top_prob * 100:.1f}% < {threshold * 100:.1f}%)"
            final_sign = "UNCERTAIN"
        elif min_logit_margin > 0.0 and logit_margin < min_logit_margin:
            rejection_reason = "LOW_DECISION_MARGIN"
            pred_status = "UNCERTAIN"
            status_msg = f"Ambiguous gesture sequence (margin {logit_margin:.2f} < {min_logit_margin:.2f})"
            final_sign = "UNCERTAIN"
        else:
            rejection_reason = "ACCEPTED"
            pred_status = "CONFIDENT"
            status_msg = f"Recognized '{top_sign}' with {top_prob * 100:.1f}% confidence"
            final_sign = top_sign

        total_time_ms = (time.perf_counter() - t_start) * 1000.0

        return {
            "success": True,
            "predicted_sign": final_sign,
            "raw_predicted_sign": top_sign,
            "confidence": round(float(top_prob), 4),
            "status": pred_status,
            "rejection_reason": rejection_reason,
            "status_message": status_msg,
            "hand_coverage": round(float(hand_coverage), 3),
            "decision_margin": round(float(logit_margin), 4),
            "wrist_motion": round(float(max_motion), 4),
            "runner_up": {
                "sign": runner_up_class,
                "probability": round(float(runner_up_prob), 4),
            },
            "gate_checks": checks,
            "top_candidates": [
                {"sign": name, "probability": round(float(prob), 4)}
                for name, prob in sorted_probs[:5]
            ],
            "all_probabilities": prob_dict,
            "temporal_window": temporal_info or {
                "duration_sec": total_frames / 30.0,
                "total_frames": total_frames,
                "sequence_length": self.sequence_length,
            },
            "inference_time_ms": round(infer_time_ms, 2),
            "total_processing_time_ms": round(total_time_ms, 2),
            "frames_processed": total_frames,
        }

    def get_classes(self) -> List[str]:
        return list(self.classes)

    def get_metadata(self) -> Dict[str, Any]:
        return dict(self.metadata)

    def close(self):
        """Releases detector resources."""
        if hasattr(self, "extractor") and self.extractor:
            self.extractor.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


class RollingInferenceBuffer:
    """
    Stateful rolling buffer helper for chunked streaming or live frame-by-frame feeds.
    Maintains a 16-frame window and recent predictions voting deque for temporal stability.
    """

    def __init__(
        self,
        engine: SignVisionInferenceEngine,
        window_size: int = 16,
        stability_count: int = 5,
        threshold: float = 0.65,
        min_hand_coverage: float = 0.50,
    ):
        self.engine = engine
        self.window_size = window_size
        self.stability_count = stability_count
        self.threshold = threshold
        self.min_hand_coverage = min_hand_coverage

        self.frame_buffer: deque = deque(maxlen=window_size)
        self.presence_buffer: deque = deque(maxlen=window_size)
        self.recent_predictions: deque = deque(maxlen=stability_count)

    def push_frame(self, bgr_frame: np.ndarray) -> Optional[Dict[str, Any]]:
        """
        Pushes a single frame, extracts landmarks, and returns prediction if buffer is full.
        """
        # Horizontal flip convention matching training
        flipped = cv2.flip(bgr_frame, 1)
        vec, stats = self.engine.extractor.extract_frame_landmarks(flipped)

        self.frame_buffer.append(vec)
        self.presence_buffer.append(stats.get("hands_detected", 0) > 0)

        if len(self.frame_buffer) < self.window_size:
            return None

        # Window is full
        hand_coverage = sum(self.presence_buffer) / float(self.window_size)
        clip_vector = np.concatenate(list(self.frame_buffer)).astype(np.float32)

        raw_result = self.engine._predict_from_feature_vector(
            clip_vector=clip_vector,
            hand_coverage=hand_coverage,
            total_frames=self.window_size,
            threshold=self.threshold,
            min_hand_coverage=self.min_hand_coverage,
            t_start=time.perf_counter(),
        )

        # Apply temporal voting
        top_sign = raw_result["predicted_sign"]
        self.recent_predictions.append(top_sign)

        vote_counts = Counter(self.recent_predictions)
        most_common, count = vote_counts.most_common(1)[0]
        required_votes = max(2, int(self.stability_count * 0.6))

        if most_common != "UNCERTAIN" and count >= required_votes:
            stable_sign = most_common
            raw_result["status"] = "CONFIDENT"
            raw_result["status_message"] = f"Stable '{stable_sign}' ({count}/{self.stability_count} votes)"
        else:
            stable_sign = "UNCERTAIN"
            raw_result["status"] = "UNCERTAIN"
            raw_result["status_message"] = "Stabilizing prediction..."

        raw_result["predicted_sign"] = stable_sign
        return raw_result

    def reset(self):
        """Resets all buffers."""
        self.frame_buffer.clear()
        self.presence_buffer.clear()
        self.recent_predictions.clear()
