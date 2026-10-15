#!/usr/bin/env python3
"""
Shared Hand Landmark Feature Extraction Module for SignVision.

Uses MediaPipe HandLandmarker Tasks API (detecting up to two hands)
to extract normalized landmark features, hand articulation, and wrist
motion across video frames.

Reused by:
- train_model.py (offline video extraction)
- test_webcam.py (real-time stream inference)
"""

import os
import sys
from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# Landmark layout constants
# 21 landmarks * 3 coords = 63 relative coords
# 1 presence flag
# 3 wrist coords (x, y, z) in normalized screen space
# 1 palm scale (wrist to middle MCP distance)
# 5 fingertip-to-wrist distances (thumb, index, middle, ring, pinky)
# 4 fingertip-to-thumb distances (index, middle, ring, pinky)
# Total per hand = 1 + 3 + 1 + 63 + 5 + 4 = 77 features
FEATURE_DIM_PER_HAND = 77
NUM_HANDS = 2
FEATURE_DIM_PER_FRAME = FEATURE_DIM_PER_HAND * NUM_HANDS  # 154 features
DEFAULT_NUM_FRAMES = 16
TOTAL_CLIP_FEATURE_DIM = FEATURE_DIM_PER_FRAME * DEFAULT_NUM_FRAMES  # 2464 features

# Fingertip indices in MediaPipe 21 landmarks
FINGERTIP_INDICES = [4, 8, 12, 16, 20]  # Thumb, Index, Middle, Ring, Pinky
WRIST_INDEX = 0
MIDDLE_MCP_INDEX = 9

# Hand landmark skeletal connections (pairs of landmark indices)
HAND_CONNECTIONS = (
    # Thumb
    (0, 1), (1, 2), (2, 3), (3, 4),
    # Index finger
    (0, 5), (5, 6), (6, 7), (7, 8),
    # Middle finger
    (0, 9), (9, 10), (10, 11), (11, 12),
    # Ring finger
    (0, 13), (13, 14), (14, 15), (15, 16),
    # Pinky finger
    (0, 17), (17, 18), (18, 19), (19, 20),
    # Knuckle bridge (palm)
    (5, 9), (9, 13), (13, 17),
)


def get_feature_config() -> Dict[str, Any]:
    """Returns the immutable specification of the feature vector."""
    return {
        "num_hands": NUM_HANDS,
        "feature_dim_per_hand": FEATURE_DIM_PER_HAND,
        "feature_dim_per_frame": FEATURE_DIM_PER_FRAME,
        "num_sampled_frames": DEFAULT_NUM_FRAMES,
        "total_clip_feature_dim": TOTAL_CLIP_FEATURE_DIM,
        "hand_slots": ["Left", "Right"],
        "layout_per_hand": [
            "presence (1)",
            "wrist_coords_normalized_screen (3)",
            "palm_scale (1)",
            "relative_normalized_landmarks_21x3 (63)",
            "wrist_to_fingertip_distances (5)",
            "thumb_to_fingertip_distances (4)",
        ],
        "normalization": "Wrist-centered, scaled by distance(wrist, middle_mcp)",
    }


class HandLandmarkerExtractor:
    """
    Encapsulates MediaPipe HandLandmarker Tasks API for deterministic,
    CPU-efficient feature extraction.
    """

    def __init__(
        self,
        model_path: str = "models/hand_landmarker.task",
        num_hands: int = 2,
        min_hand_detection_confidence: float = 0.5,
        min_hand_presence_confidence: float = 0.5,
        min_tracking_confidence: float = 0.5,
    ):
        self.model_path = os.path.abspath(model_path)
        if not os.path.isfile(self.model_path):
            raise FileNotFoundError(
                f"MediaPipe task model file not found at: {self.model_path}\n"
                "Please ensure models/hand_landmarker.task exists."
            )

        self.num_hands = num_hands
        self.min_hand_detection_confidence = min_hand_detection_confidence
        self.min_hand_presence_confidence = min_hand_presence_confidence
        self.min_tracking_confidence = min_tracking_confidence

        base_options = python.BaseOptions(model_asset_path=self.model_path)
        options = vision.HandLandmarkerOptions(
            base_options=base_options,
            running_mode=vision.RunningMode.IMAGE,
            num_hands=self.num_hands,
            min_hand_detection_confidence=self.min_hand_detection_confidence,
            min_hand_presence_confidence=self.min_hand_presence_confidence,
            min_tracking_confidence=self.min_tracking_confidence,
        )
        self.detector = vision.HandLandmarker.create_from_options(options)

    def extract_frame_landmarks(
        self, bgr_image: np.ndarray
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Processes a single BGR OpenCV frame and returns a fixed-dimension
        (154,) feature vector and extraction statistics.
        """
        if bgr_image is None or bgr_image.size == 0:
            return np.zeros(FEATURE_DIM_PER_FRAME, dtype=np.float32), {
                "hands_detected": 0,
                "handedness": [],
            }

        # MediaPipe expects RGB
        rgb_image = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_image)
        result = self.detector.detect(mp_image)

        num_detected = len(result.hand_landmarks) if result.hand_landmarks else 0
        detected_categories = []
        if result.handedness:
            for hand_category_list in result.handedness:
                if hand_category_list:
                    detected_categories.append(hand_category_list[0].category_name)
                else:
                    detected_categories.append("Unknown")

        # Slots: [Left, Right]
        left_hand_features = np.zeros(FEATURE_DIM_PER_HAND, dtype=np.float32)
        right_hand_features = np.zeros(FEATURE_DIM_PER_HAND, dtype=np.float32)

        if num_detected == 1:
            cat = detected_categories[0] if detected_categories else "Unknown"
            feats = self._extract_single_hand(result.hand_landmarks[0])
            if cat == "Left":
                left_hand_features = feats
            elif cat == "Right":
                right_hand_features = feats
            else:
                # Fallback based on horizontal wrist position: < 0.5 -> Left slot
                wrist_x = result.hand_landmarks[0][WRIST_INDEX].x
                if wrist_x < 0.5:
                    left_hand_features = feats
                else:
                    right_hand_features = feats

        elif num_detected >= 2:
            # We have at least 2 hands. Sort or assign to Left / Right.
            cat0 = detected_categories[0] if len(detected_categories) > 0 else "Unknown"
            cat1 = detected_categories[1] if len(detected_categories) > 1 else "Unknown"

            if cat0 == "Left" and cat1 == "Right":
                left_hand_features = self._extract_single_hand(result.hand_landmarks[0])
                right_hand_features = self._extract_single_hand(result.hand_landmarks[1])
            elif cat0 == "Right" and cat1 == "Left":
                right_hand_features = self._extract_single_hand(result.hand_landmarks[0])
                left_hand_features = self._extract_single_hand(result.hand_landmarks[1])
            else:
                # Disambiguate by horizontal wrist position
                wrist_x0 = result.hand_landmarks[0][WRIST_INDEX].x
                wrist_x1 = result.hand_landmarks[1][WRIST_INDEX].x
                if wrist_x0 <= wrist_x1:
                    left_hand_features = self._extract_single_hand(result.hand_landmarks[0])
                    right_hand_features = self._extract_single_hand(result.hand_landmarks[1])
                else:
                    left_hand_features = self._extract_single_hand(result.hand_landmarks[1])
                    right_hand_features = self._extract_single_hand(result.hand_landmarks[0])

        frame_vector = np.concatenate([left_hand_features, right_hand_features]).astype(
            np.float32
        )
        stats = {
            "hands_detected": num_detected,
            "handedness": detected_categories,
            "hand_landmarks": result.hand_landmarks if result.hand_landmarks else [],
        }
        return frame_vector, stats

    def _extract_single_hand(self, landmarks) -> np.ndarray:
        """
        Extracts a normalized 77-dim vector for a single detected hand.
        """
        # Convert 21 landmarks to (21, 3) numpy array
        coords = np.zeros((21, 3), dtype=np.float32)
        for i in range(21):
            coords[i, 0] = landmarks[i].x
            coords[i, 1] = landmarks[i].y
            coords[i, 2] = landmarks[i].z

        wrist = coords[WRIST_INDEX]
        middle_mcp = coords[MIDDLE_MCP_INDEX]

        # Hand scale: Euclidean distance between wrist and middle MCP
        scale = float(np.linalg.norm(middle_mcp - wrist))
        if scale < 1e-4:
            scale = 1e-4

        # Relative landmarks normalized by palm scale
        rel_coords = (coords - wrist) / scale

        # Distances: wrist to fingertips (normalized by scale)
        wrist_to_tips = []
        for tip_idx in FINGERTIP_INDICES:
            d = float(np.linalg.norm(coords[tip_idx] - wrist)) / scale
            wrist_to_tips.append(d)

        # Distances: thumb tip to other fingertips (normalized by scale)
        thumb_tip = coords[4]
        thumb_to_tips = []
        for tip_idx in FINGERTIP_INDICES[1:]:  # 8, 12, 16, 20
            d = float(np.linalg.norm(coords[tip_idx] - thumb_tip)) / scale
            thumb_to_tips.append(d)

        # Vector assembly:
        # 1: presence flag
        # 3: wrist coords
        # 1: palm scale
        # 63: rel coords
        # 5: wrist to tips
        # 4: thumb to tips
        hand_vector = np.concatenate(
            [
                np.array([1.0], dtype=np.float32),
                wrist,
                np.array([scale], dtype=np.float32),
                rel_coords.flatten(),
                np.array(wrist_to_tips, dtype=np.float32),
                np.array(thumb_to_tips, dtype=np.float32),
            ]
        ).astype(np.float32)

        return hand_vector

    def extract_video_features(
        self,
        video_path: str,
        num_sampled_frames: int = DEFAULT_NUM_FRAMES,
        mirror_horizontal: bool = False,
        max_duration_sec: Optional[float] = None,
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Reads a video file, uniformly samples `num_sampled_frames` (default 16),
        extracts landmark features for each frame, and returns a fixed-length
        feature vector of shape (2464,) along with clip-level metadata.
        """
        if not os.path.isfile(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise IOError(f"Could not open video file: {video_path}")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = float(cap.get(cv2.CAP_PROP_FPS))
        if fps <= 0:
            fps = 30.0

        # Read frames into memory
        all_frames = []
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                break
            all_frames.append(frame)
        cap.release()

        actual_frame_count = len(all_frames)
        if actual_frame_count == 0:
            raise ValueError(f"No frames could be decoded from video: {video_path}")

        duration_sec = actual_frame_count / fps

        # If clip is longer than bounded window (e.g., mobile over-recording > 3.5s),
        # bound the sequence to the active gesture distribution matching training (~3.0s)
        if max_duration_sec is not None and duration_sec > max_duration_sec:
            max_frames = int(max_duration_sec * fps)
            # Use centered or start-bounded active window
            start_frame = max(0, (actual_frame_count - max_frames) // 2)
            end_frame = min(actual_frame_count, start_frame + max_frames)
            sampled_indices = np.linspace(start_frame, end_frame - 1, num_sampled_frames, dtype=int)
        elif actual_frame_count >= num_sampled_frames:
            sampled_indices = np.linspace(
                0, actual_frame_count - 1, num_sampled_frames, dtype=int
            )
        else:
            # Short clip edge case: repeat last frame
            indices = list(range(actual_frame_count))
            while len(indices) < num_sampled_frames:
                indices.append(indices[-1])
            sampled_indices = np.array(indices[:num_sampled_frames], dtype=int)

        sampled_frames = [all_frames[idx] for idx in sampled_indices]
        del all_frames  # Free remaining unneeded frame buffers immediately

        # Extract features for sampled frames (flip only the 16 sampled frames)
        frame_vectors = []
        frames_with_hands = 0
        total_hands_detected = 0

        for frame in sampled_frames:
            proc_frame = cv2.flip(frame, 1) if mirror_horizontal else frame
            vec, stats = self.extract_frame_landmarks(proc_frame)
            frame_vectors.append(vec)
            if stats["hands_detected"] > 0:
                frames_with_hands += 1
                total_hands_detected += stats["hands_detected"]

        # Flatten (16, 154) -> (2464,)
        clip_vector = np.concatenate(frame_vectors).astype(np.float32)

        coverage_ratio = float(frames_with_hands) / float(num_sampled_frames)
        metadata = {
            "video_path": video_path,
            "total_frames_in_file": actual_frame_count,
            "fps": fps,
            "duration_sec": duration_sec,
            "num_sampled_frames": num_sampled_frames,
            "frames_with_hands": frames_with_hands,
            "coverage_ratio": coverage_ratio,
            "avg_hands_per_frame": total_hands_detected / float(num_sampled_frames),
            "sampled_indices": sampled_indices.tolist(),
        }

        return clip_vector, metadata

    def close(self):
        """Releases MediaPipe detector resources."""
        if hasattr(self, "detector") and self.detector is not None:
            self.detector.close()
            self.detector = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
