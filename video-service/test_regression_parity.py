import os
import sys
from pathlib import Path
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

ROOT_DIR = Path(__file__).resolve().parent
REPO_ROOT = ROOT_DIR.parent
BUNDLE_DIR = REPO_ROOT / "signvision_isl_inference_bundle"
DATA_RAW_DIR = Path("/home/pruthvi/Documents/test/data/raw")

if str(BUNDLE_DIR) not in sys.path:
    sys.path.insert(0, str(BUNDLE_DIR))
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from main import app
from inference import SignVisionInferenceEngine
from src.landmark_features import DEFAULT_NUM_FRAMES

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture(scope="module")
def engine():
    eng = SignVisionInferenceEngine(
        model_path=str(BUNDLE_DIR / "models" / "sign_classifier.joblib"),
        metadata_path=str(BUNDLE_DIR / "models" / "model_metadata.json"),
        task_model_path=str(BUNDLE_DIR / "models" / "hand_landmarker.task"),
        default_threshold=0.50,
        default_min_hand_coverage=0.30,
    )
    yield eng
    eng.close()

def test_feature_parity_numerical_tolerance(engine):
    """
    PART 2 Parity Check: Verifies that standalone uniform frame feature extraction
    matches engine.extractor.extract_video_features with documented tolerance (< 1e-5).
    """
    if not DATA_RAW_DIR.exists():
        pytest.skip(f"Raw dataset videos not found at {DATA_RAW_DIR}. Skipping parity test in CI.")

    classes_to_test = ["GOOD_MORNING", "THANK_YOU", "WORK", "HOW_ARE_YOU", "PLEASE"]
    tested_count = 0

    for cls in classes_to_test:
        cls_dir = DATA_RAW_DIR / cls
        if not cls_dir.exists():
            continue
        clips = sorted(list(cls_dir.glob("*.mp4")))
        if not clips:
            continue

        clip_path = str(clips[0])

        # 1. Standalone test_webcam manual extraction
        cap = cv2.VideoCapture(clip_path)
        frames = []
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                break
            frames.append(frame)
        cap.release()

        n_frames = len(frames)
        indices = np.linspace(0, n_frames - 1, DEFAULT_NUM_FRAMES, dtype=int)
        sampled = [frames[i] for i in indices]

        standalone_vecs = []
        for f in sampled:
            vec, _ = engine.extractor.extract_frame_landmarks(f)
            standalone_vecs.append(vec)
        standalone_clip_vec = np.concatenate(standalone_vecs).astype(np.float32)

        # 2. Production extract_video_features
        prod_clip_vec, meta = engine.extractor.extract_video_features(clip_path, mirror_horizontal=False)

        max_diff = float(np.max(np.abs(standalone_clip_vec - prod_clip_vec)))
        assert max_diff < 1e-5, f"Feature mismatch on {cls}: max_diff={max_diff}"

        # Check prediction parity
        standalone_probs = engine.pipeline.predict_proba(standalone_clip_vec.reshape(1, -1))[0]
        prod_probs = engine.pipeline.predict_proba(prod_clip_vec.reshape(1, -1))[0]
        prob_diff = float(np.max(np.abs(standalone_probs - prod_probs)))
        assert prob_diff < 1e-5, f"Probability mismatch on {cls}: prob_diff={prob_diff}"

        tested_count += 1

    assert tested_count >= 3, "At least 3 classes must be tested for parity."

def test_mobile_front_camera_flow(client):
    """
    PART 4 Mobile Check: When mobile records with mirror={facing === 'front'},
    is_mirrored=true informs the service not to re-flip, preserving sign semantics.
    """
    clip_dir = DATA_RAW_DIR / "THANK_YOU"
    if not clip_dir.exists():
        pytest.skip("No THANK_YOU clips found")
    clips = list(clip_dir.glob("*.mp4"))
    if not clips:
        pytest.skip("No clips")

    sample_clip = clips[0]
    with open(sample_clip, "rb") as f:
        video_bytes = f.read()

    # Client informs backend the video is already mirrored (from mobile front camera)
    response = client.post(
        "/api/translate-video?is_mirrored=true&facing_mode=front",
        files={"video": (sample_clip.name, video_bytes, "video/mp4")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "CONFIDENT"
    assert data["predicted_sign"] == "THANK_YOU"
    assert data["translation"] == "Thank you"
    assert data["confidence"] > 0.90
    assert data["rejection_reason"] == "ACCEPTED"
    assert "runner_up" in data

def test_web_camera_unmirrored_flow(client):
    """
    PART 4 Web Check: When web records via MediaRecorder (unmirrored raw camera feed),
    mirroring is applied once by the service to match the mirrored training data.
    """
    clip_dir = DATA_RAW_DIR / "THANK_YOU"
    if not clip_dir.exists():
        pytest.skip("No THANK_YOU clips found")
    clips = list(clip_dir.glob("*.mp4"))
    if not clips:
        pytest.skip("No clips")

    # Invert the clip once horizontally to simulate raw unmirrored sensor feed
    cap = cv2.VideoCapture(str(clips[0]))
    unmirrored_frames = []
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    while True:
        ret, frame = cap.read()
        if not ret or frame is None:
            break
        # Unmirror the training clip
        unmirrored_frames.append(cv2.flip(frame, 1))
    cap.release()

    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        tmp_name = tmp.name
        out = cv2.VideoWriter(tmp_name, cv2.VideoWriter_fourcc(*"VP80"), fps, (w, h))
        if not out.isOpened():
            out = cv2.VideoWriter(tmp_name, cv2.VideoWriter_fourcc(*"MJPG"), fps, (w, h))
        for f in unmirrored_frames:
            out.write(f)
        out.release()

    try:
        with open(tmp_name, "rb") as f:
            unmirrored_bytes = f.read()

        # Web request with is_mirrored=false
        response = client.post(
            "/api/translate-video?is_mirrored=false",
            files={"video": ("web_record.webm", unmirrored_bytes, "video/webm")}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "CONFIDENT"
        assert data["predicted_sign"] == "THANK_YOU"
        assert data["confidence"] > 0.85
    finally:
        if os.path.exists(tmp_name):
            os.remove(tmp_name)

def test_negative_cases_and_diagnostics(client, tmp_path):
    """
    PART 5 & 8 Diagnostics: Verifies rejection reasons for low coverage, low confidence,
    and invalid videos.
    """
    # 1. Blank frames -> INSUFFICIENT_HAND_COVERAGE
    blank_video_path = str(tmp_path / "blank.mp4")
    out = cv2.VideoWriter(blank_video_path, cv2.VideoWriter_fourcc(*"mp4v"), 30.0, (320, 240))
    for _ in range(30):
        out.write(np.zeros((240, 320, 3), dtype=np.uint8))
    out.release()

    with open(blank_video_path, "rb") as f:
        blank_bytes = f.read()

    res = client.post(
        "/api/translate-video",
        files={"video": ("blank.mp4", blank_bytes, "video/mp4")}
    )
    assert res.status_code == 200
    d = res.json()
    assert d["status"] == "UNCERTAIN"
    assert d["rejection_reason"] == "INSUFFICIENT_HAND_COVERAGE"
    assert d["gate_checks"]["hand_coverage"]["passed"] is False

    # 2. Strict confidence override -> LOW_CLASSIFIER_CONFIDENCE
    clip_dir = DATA_RAW_DIR / "GOOD_MORNING"
    if clip_dir.exists():
        clips = list(clip_dir.glob("*.mp4"))
        if clips:
            with open(clips[0], "rb") as f:
                c_bytes = f.read()
            res2 = client.post(
                "/api/translate-video?threshold=0.99999",
                files={"video": ("good_morning.mp4", c_bytes, "video/mp4")}
            )
            assert res2.status_code == 200
            d2 = res2.json()
            assert d2["status"] == "UNCERTAIN"
            assert d2["rejection_reason"] == "LOW_CLASSIFIER_CONFIDENCE"
            assert d2["gate_checks"]["confidence"]["passed"] is False
