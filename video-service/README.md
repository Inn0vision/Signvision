# SignVision Video Translation Microservice (`video-service/`)

> **FastAPI microservice translating Indian Sign Language (ISL) video recordings into English text using a local MediaPipe + Scikit-Learn ISL recognition model (23 classes).**

---

## ⚡ 1. Brief Quickstart & Endpoints (TL;DR)

### Quick Commands

```bash
# 1. Setup virtual environment & dependencies
cd video-service
source ../.venv/bin/activate
pip install -r requirements.txt

# 2. Run test suite to verify model & API
pytest test_video_service.py -v

# 3. Start the FastAPI server on port 8001
uvicorn main:app --host 0.0.0.0 --port 8001
```

### Key API Endpoints

| Method | Endpoint | Description | Payload | Response |
|:---|:---|:---|:---|:---|
| `GET` | `/health` | Microservice health check & engine status | None | `{"status": "healthy", "classes_count": 23, "threshold": 0.50, ...}` |
| `GET` | `/api/classes` | Returns all 23 supported ISL sign classes | None | `{"total_classes": 23, "classes": [...]}` |
| `POST` | `/api/translate-video` | ISL video translation | Multipart `video` file (`.mp4`, `.webm`) | `{"translation": "Good morning", "status": "CONFIDENT", "confidence": 0.88, ...}` |

---

## 🛠️ 2. Detailed Technical Specification

### 2.1 Microservice Architecture

The video service runs 100% locally on CPU without remote cloud or third-party AI dependencies:

```
[Mobile/Web Client]
       │
       ▼ (Multipart POST /api/translate-video)
[FastAPI on Port 8001]
       │
       ▼ (Saves buffer to /tmp/<uuid>.<ext>)
[Async Worker Thread (asyncio.to_thread)]
       │
       ▼
[MediaPipe HandLandmarker Tasks API] ────► Uniform 16-frame sampling
       │                                  - 2 hands x 77 normalized landmark features
       │                                  - 154 features/frame -> 2464 total features
       ▼
[Scikit-Learn Classifier Pipeline] ──────► StandardScaler + RBF-SVM / LogisticRegression
       │                                  - Evaluates predicted class probability
       │                                  - Default 50% threshold gating
       │                                  - Hand detection coverage gating (min 50%)
       ▼
[FastAPI Response] ─────────────────────► {
                                             "translation": "Good morning",
                                             "status": "CONFIDENT",
                                             "confidence": 0.88,
                                             "hand_coverage": 0.81
                                           }
       │
       ▼ (finally block)
[Deterministic Cleanup of /tmp/ file]
```

---

### 2.2 Configuration & Dependencies

#### Python Dependencies (`requirements.txt`)
- `fastapi`: High-performance asynchronous web framework.
- `uvicorn`: ASGI web server.
- `python-multipart`: Streaming multipart form-data parser for video uploads.
- `opencv-python-headless`: Video frame decoding and RGB color conversions.
- `mediapipe`: Google MediaPipe hand landmark extraction.
- `scikit-learn`: Trained machine learning classifier.
- `joblib`: Model pipeline serialization and loading.
- `numpy`: Array manipulation.
- `python-dotenv`: Environment variable loader.

#### Environment Variables
```ini
SIGN_CONFIDENCE_THRESHOLD=0.50   # Default 50% acceptance threshold
MIN_HAND_COVERAGE=0.50           # Minimum fraction of frames with hands detected
```

---

### 2.3 Supported Vocabulary (23 Classes)

Dynamically loaded from `models/model_metadata.json`:

`BROTHER`, `COLLEGE`, `DO_YOU_UNDERSTAND`, `GOOD_MORNING`, `GOOD_NIGHT`, `HE_IS_FATHER`, `HOW_ARE_YOU`, `HUSBAN`, `ITS_BEAUTIFUL_PLACE`, `LIKE_DANCE`, `MAN`, `NAMSATE`, `NO`, `PLEASE`, `SAD`, `SCHOOL`, `SHOP`, `SORRY`, `THANK_YOU`, `WHAT_IS_YOUR_NAME`, `WOMEN`, `WORK`, `YES`
