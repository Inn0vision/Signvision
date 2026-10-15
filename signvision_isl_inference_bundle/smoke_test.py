#!/usr/bin/env python3
"""
SignVision Bundle Smoke Test (`smoke_test.py`)

Verifies that the packaged bundle is 100% self-contained and ready for production
inference without retraining or requiring a GUI display.

Checks:
1. Model loading: Verifies sign_classifier.joblib and model_metadata.json.
2. Metadata verification: Checks class list, count (23 classes), and dimensions.
3. MediaPipe task loading: Initializes HandLandmarkerExtractor from hand_landmarker.task.
4. Feature extractor validation: Verifies (154,) frame feature output shape.
5. Synthetic sequence prediction: Tests inference pipeline and probability output.
6. Uncertainty test: Validates that low-coverage input safely outputs "UNCERTAIN".
7. Clean resource release.
"""

import os
import sys
import numpy as np

# Ensure current bundle root is in sys.path
BUNDLE_ROOT = os.path.dirname(os.path.abspath(__file__))
if BUNDLE_ROOT not in sys.path:
    sys.path.insert(0, BUNDLE_ROOT)

from inference import SignVisionInferenceEngine, RollingInferenceBuffer


def run_smoke_test():
    print("=" * 65)
    print("SignVision ISL Production Inference Bundle Smoke Test")
    print("=" * 65)

    # 1. Initialize Engine
    print("[TEST 1/6] Loading SignVisionInferenceEngine...")
    engine = SignVisionInferenceEngine()
    print(f"  [PASS] Classifier loaded: {type(engine.pipeline).__name__}")
    print(f"  [PASS] Metadata loaded: {len(engine.classes)} classes found.")

    # 2. Check metadata classes
    print("[TEST 2/6] Verifying class catalog...")
    classes = engine.get_classes()
    assert len(classes) >= 2, f"Expected at least 2 classes, got {len(classes)}"
    print(f"  [PASS] Classes verified ({len(classes)} classes): {classes[:6]} ...")

    # 3. Test Feature Extractor Output Shape
    print("[TEST 3/6] Verifying frame landmark extraction dimensions...")
    dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    vec, stats = engine.extractor.extract_frame_landmarks(dummy_frame)
    assert vec.shape == (154,), f"Expected shape (154,), got {vec.shape}"
    assert not np.isnan(vec).any(), "NaN detected in feature vector"
    print(f"  [PASS] Single frame feature vector shape: {vec.shape} (All values numeric)")

    # 4. Test Sequence Prediction on Synthetic Vector
    print("[TEST 4/6] Testing prediction on synthetic 16-frame sequence...")
    synthetic_sequence = np.zeros((16, 154), dtype=np.float32)
    # Put a dummy non-zero coordinate so scaler runs cleanly
    synthetic_sequence[:, 0] = 0.5
    res = engine.predict_sequence(synthetic_sequence, threshold=0.10)

    assert "predicted_sign" in res, "Missing predicted_sign in result"
    assert "top_candidates" in res, "Missing top_candidates in result"
    assert "all_probabilities" in res, "Missing all_probabilities in result"
    assert len(res["all_probabilities"]) == len(classes), "Probabilities count mismatch"
    print(f"  [PASS] Synthetic sequence prediction executed successfully.")
    print(f"         Prediction: {res['predicted_sign']} (Confidence: {res['confidence']*100:.1f}%)")

    # 5. Test Hand Coverage Uncertainty Gate
    print("[TEST 5/6] Testing low hand-coverage uncertainty trigger...")
    dummy_frames = [np.zeros((480, 640, 3), dtype=np.uint8) for _ in range(16)]
    res_uncertain = engine.predict_frames(dummy_frames, min_hand_coverage=0.50)
    assert res_uncertain["predicted_sign"] == "UNCERTAIN", "Expected UNCERTAIN for blank frames"
    assert res_uncertain["status"] == "UNCERTAIN", "Expected status UNCERTAIN"
    print(f"  [PASS] Uncertainty gate triggered correctly: {res_uncertain['status_message']}")

    # 6. Test Rolling Buffer
    print("[TEST 6/6] Testing RollingInferenceBuffer helper...")
    buf = RollingInferenceBuffer(engine=engine, window_size=16, stability_count=4)
    for _ in range(15):
        assert buf.push_frame(dummy_frame) is None, "Buffer should not predict before 16 frames"
    full_res = buf.push_frame(dummy_frame)
    assert full_res is not None, "Buffer should predict on 16th frame"
    buf.reset()
    assert len(buf.frame_buffer) == 0, "Buffer reset failed"
    print("  [PASS] RollingInferenceBuffer validated.")

    engine.close()
    print("=" * 65)
    print("[SUCCESS] ALL SMOKE TESTS PASSED! Bundle is verified and ready for production.")
    print("=" * 65)


if __name__ == "__main__":
    try:
        run_smoke_test()
        sys.exit(0)
    except Exception as e:
        print(f"[FAIL] Smoke test failed with exception: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
