# SignVision ISL Production Inference Bundle

A lightweight, self-contained inference package for the custom **Indian Sign Language (ISL)** multi-class recognition model.

Built for seamless integration into existing **FastAPI microservices**, **Flask backends**, and **cloud containers** (Fedora/Linux, Docker, Cloud Run, AWS).

---

## 1. Package Structure

```text
signvision_isl_inference_bundle/
├── models/
│   ├── sign_classifier.joblib   # Trained scikit-learn classifier pipeline (StandardScaler + RBF-SVM)
│   ├── model_metadata.json      # Dynamic class catalog (23 classes), IDs, and feature specs
│   └── hand_landmarker.task     # Google MediaPipe hand landmark task asset
├── src/
│   ├── landmark_features.py     # 16-frame uniform MediaPipe landmark feature extraction
│   └── __init__.py
├── inference.py                 # SignVisionInferenceEngine & RollingInferenceBuffer classes
├── smoke_test.py                # Standalone verification script (runs in ~2s, no GUI needed)
├── requirements-inference.txt   # Minimal headless runtime dependencies
├── bundle_manifest.json         # SHA-256 checksums and file descriptions
└── README.md                    # Integration guide
```

---

## 2. Supported Vocabulary (23 Classes)

`BROTHER`, `COLLEGE`, `DO_YOU_UNDERSTAND`, `GOOD_MORNING`, `GOOD_NIGHT`, `HE_IS_FATHER`, `HOW_ARE_YOU`, `HUSBAN`, `ITS_BEAUTIFUL_PLACE`, `LIKE_DANCE`, `MAN`, `NAMSATE`, `NO`, `PLEASE`, `SAD`, `SCHOOL`, `SHOP`, `SORRY`, `THANK_YOU`, `WHAT_IS_YOUR_NAME`, `WOMEN`, `WORK`, `YES`

---

## 3. Installation

In your target microservice environment:

```bash
pip install -r requirements-inference.txt
```

Verify bundle integrity anytime:

```bash
python smoke_test.py
```

---

## 4. FastAPI Integration Example

Copy the bundle directory into your FastAPI service (e.g., inside `app/signvision/` or alongside `main.py`).

```python
import os
import shutil
import tempfile
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Query, HTTPException
from inference import SignVisionInferenceEngine

engine: SignVisionInferenceEngine = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine
    # Initialize engine once on startup
    engine = SignVisionInferenceEngine()
    print(f"SignVision loaded {len(engine.get_classes())} classes.")
    yield
    if engine:
        engine.close()

app = FastAPI(title="Video Sign Recognition Service", lifespan=lifespan)

@app.get("/signs/classes")
def list_classes():
    """Returns all 23 supported ISL sign classes."""
    return {"total_classes": len(engine.get_classes()), "classes": engine.get_classes()}

@app.post("/signs/predict-video")
async def predict_sign_from_video(
    video: UploadFile = File(..., description="Uploaded video clip (.mp4, .webm, .avi, .mov)"),
    threshold: float = Query(0.65, ge=0.0, le=1.0),
    min_hand_coverage: float = Query(0.50, ge=0.0, le=1.0),
):
    """
    Accepts video upload from mobile (Expo) or Web app and returns predicted sign.
    """
    # Write to temporary file
    suffix = os.path.splitext(video.filename or "clip.mp4")[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp_path = tmp.name
        shutil.copyfileobj(video.file, tmp)

    try:
        result = engine.predict_video(
            video_path=tmp_path,
            threshold=threshold,
            min_hand_coverage=min_hand_coverage,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Inference error: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
```

---

## 5. Direct Python API Usage

```python
from inference import SignVisionInferenceEngine

# 1. Initialize engine
engine = SignVisionInferenceEngine()

# 2. Predict on a video file
result = engine.predict_video("sample_sign.mp4", threshold=0.65)
print("Recognized Sign:", result["predicted_sign"])
print("Confidence:", result["confidence"])
print("Top Candidates:", result["top_candidates"])

# 3. Predict on in-memory BGR frames (e.g. from OpenCV or RTSP stream)
# frames = [frame1, frame2, ...]
# result = engine.predict_frames(frames)
```

---

## 6. Response Schema

```json
{
  "success": true,
  "predicted_sign": "LIKE_DANCE",
  "confidence": 0.9985,
  "status": "CONFIDENT",
  "status_message": "Recognized 'LIKE_DANCE' with 99.8% confidence",
  "hand_coverage": 0.938,
  "top_candidates": [
    {"sign": "LIKE_DANCE", "probability": 0.9985},
    {"sign": "NAMSATE", "probability": 0.0010},
    {"sign": "HOW_ARE_YOU", "probability": 0.0002}
  ],
  "all_probabilities": {
    "BROTHER": 0.0,
    "COLLEGE": 0.0,
    "LIKE_DANCE": 0.9985,
    ...
  },
  "inference_time_ms": 1.45,
  "total_processing_time_ms": 42.10,
  "frames_processed": 76
}
```
