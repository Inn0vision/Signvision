import io
import os
from pathlib import Path
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from main import app, format_sign_label, CONFIDENCE_THRESHOLD, MIN_HAND_COVERAGE

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["port"] == 8001
    assert data["engine_ready"] is True
    assert data["classes_count"] == 23
    assert data["threshold"] == CONFIDENCE_THRESHOLD
    assert data["min_hand_coverage"] == MIN_HAND_COVERAGE

def test_list_classes(client):
    response = client.get("/api/classes")
    assert response.status_code == 200
    data = response.json()
    assert data["total_classes"] == 23
    assert "GOOD_MORNING" in data["classes"]
    assert "GOOD_NIGHT" in data["classes"]
    assert "THANK_YOU" in data["classes"]

def test_format_sign_label():
    assert format_sign_label("GOOD_MORNING") == "Good morning"
    assert format_sign_label("GOOD_NIGHT") == "Good night"
    assert format_sign_label("THANK_YOU") == "Thank you"
    assert format_sign_label("UNKNOWN_SIGN") == "Unknown Sign"
    assert format_sign_label("UNCERTAIN") == "UNCLEAR SIGN SEQUENCE"
    assert format_sign_label("") == "UNCLEAR SIGN SEQUENCE"

def test_translate_video_empty_file(client):
    response = client.post(
        "/api/translate-video",
        files={"video": ("empty.mp4", b"", "video/mp4")}
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()

def test_translate_video_invalid_format(client):
    response = client.post(
        "/api/translate-video",
        files={"video": ("test.txt", b"not a video", "text/plain")}
    )
    assert response.status_code == 400
    assert "unsupported video type" in response.json()["detail"].lower()

def test_translate_video_blank_frames_uncertainty(client, tmp_path):
    # Create a 1-second blank mp4 video (0 landmarks)
    test_video_path = str(tmp_path / "blank_test.mp4")
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(test_video_path, fourcc, 16.0, (320, 240))
    for _ in range(16):
        frame = np.zeros((240, 320, 3), dtype=np.uint8)
        out.write(frame)
    out.release()

    with open(test_video_path, "rb") as f:
        video_bytes = f.read()

    response = client.post(
        "/api/translate-video",
        files={"video": ("blank_test.mp4", video_bytes, "video/mp4")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "UNCERTAIN"
    assert data["predicted_sign"] == "UNCERTAIN"
    assert data["translation"] == "UNCLEAR SIGN SEQUENCE"
    assert data["hand_coverage"] == 0.0
    assert "low hand detection coverage" in data["status_message"].lower()

def test_translate_video_confident_sample(client):
    """Test that a valid, well-performed recorded sign clip translates with CONFIDENT status."""
    sample_dir = Path("/home/pruthvi/Documents/test/data/raw/GOOD_MORNING")
    if not sample_dir.exists():
        pytest.skip("Local training clips not present in test environment")

    clips = list(sample_dir.glob("*.mp4"))
    if not clips:
        pytest.skip("No GOOD_MORNING mp4 clips found")

    sample_clip = clips[0]
    with open(sample_clip, "rb") as f:
        video_bytes = f.read()

    response = client.post(
        "/api/translate-video",
        files={"video": (sample_clip.name, video_bytes, "video/mp4")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "CONFIDENT"
    assert data["predicted_sign"] == "GOOD_MORNING"
    assert data["translation"] == "Good morning"
    assert data["confidence"] >= 0.50
    assert data["hand_coverage"] >= 0.50
    assert len(data["top_candidates"]) > 0
    assert data["top_candidates"][0]["sign"] == "GOOD_MORNING"

def test_translate_video_high_threshold_causes_uncertainty(client):
    """Test that setting an impossibly high threshold forces status UNCERTAIN and UNCLEAR SIGN SEQUENCE."""
    sample_dir = Path("/home/pruthvi/Documents/test/data/raw/GOOD_MORNING")
    if not sample_dir.exists():
        pytest.skip("Local training clips not present in test environment")

    clips = list(sample_dir.glob("*.mp4"))
    if not clips:
        pytest.skip("No GOOD_MORNING mp4 clips found")

    sample_clip = clips[0]
    with open(sample_clip, "rb") as f:
        video_bytes = f.read()

    # Pass an unattainable confidence threshold (0.9999) as query param
    response = client.post(
        "/api/translate-video?threshold=0.9999",
        files={"video": (sample_clip.name, video_bytes, "video/mp4")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "UNCERTAIN"
    assert data["predicted_sign"] == "UNCERTAIN"
    assert data["translation"] == "UNCLEAR SIGN SEQUENCE"
    assert "low confidence" in data["status_message"].lower()

def test_translate_video_high_min_coverage_causes_uncertainty(client):
    """Test that strict hand coverage gating forces UNCERTAIN status and UNCLEAR SIGN SEQUENCE."""
    sample_dir = Path("/home/pruthvi/Documents/test/data/raw/GOOD_MORNING")
    if not sample_dir.exists():
        pytest.skip("Local training clips not present in test environment")

    clips = list(sample_dir.glob("*.mp4"))
    if not clips:
        pytest.skip("No GOOD_MORNING mp4 clips found")

    sample_clip = clips[0]
    with open(sample_clip, "rb") as f:
        video_bytes = f.read()

    # Require 100% hand coverage across all 16 frames
    response = client.post(
        "/api/translate-video?min_hand_coverage=1.0",
        files={"video": (sample_clip.name, video_bytes, "video/mp4")}
    )
    assert response.status_code == 200
    data = response.json()
    # If not all 16 sampled frames had hands (coverage < 1.0), coverage triggers UNCERTAIN
    if data["hand_coverage"] < 1.0:
        assert data["status"] == "UNCERTAIN"
        assert data["predicted_sign"] == "UNCERTAIN"
        assert data["translation"] == "UNCLEAR SIGN SEQUENCE"
        assert "low hand detection coverage" in data["status_message"].lower()
    else:
        assert data["status"] == "CONFIDENT"

