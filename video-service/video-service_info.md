# SignVision — Video Microservice Technical Specification (`video-service_info.md`)

> **Technical specification for the local ISL recognition microservice (MediaPipe + Scikit-Learn), thresholding, and lifecycle management.**

---

## ⚡ 1. Brief Summary (TL;DR)

The Video Microservice (`video-service/`) runs on port 8001 and provides sign-to-English translation by interpreting sign language video clips via a locally trained MediaPipe + Scikit-Learn model.

### Technical Metrics
- **Runtime**: FastAPI / Uvicorn (Port 8001, bound to `0.0.0.0`)
- **Model**: Scikit-Learn pipeline (StandardScaler + RBF-SVM / LogisticRegression) trained on 23 ISL gesture classes.
- **Feature Extraction**: Google MediaPipe HandLandmarker Tasks API (`models/hand_landmarker.task`), 16 uniform sampled frames, 154 features/frame (77 per hand), 2464 total clip dimensions.
- **Hardware Requirement**: Pure CPU execution (no GPU required).
- **Supported Formats**: `.mp4`, `.webm`, `.mov`, `.avi`, `.mkv`.
- **Default Acceptance Threshold**: 0.50 (50% probability requirement).
- **Hand Coverage Gating**: 0.50 (minimum 50% of frames must contain detected hands).
- **Typical Latency**: ~200ms – 600ms on CPU.

---

## 🛠️ 2. Detailed Technical Specification

### 2.1 File Ingestion & Storage Pipeline

When a client submits a video via `POST /api/translate-video`:

1. Unique temporary file `/tmp/<uuid>.<ext>` is created.
2. Multipart video chunks are saved.
3. In `asyncio.to_thread()`, `engine.predict_video()` decodes video frames with OpenCV, uniformly samples 16 frames, extracts MediaPipe landmarks, and calls `pipeline.predict_proba()`.
4. Evaluates probability of predicted class against `SIGN_CONFIDENCE_THRESHOLD` (0.50) and hand coverage against `MIN_HAND_COVERAGE` (0.50).
5. If confident, returns `{ "translation": "Good morning", "status": "CONFIDENT", "confidence": 0.88, ... }`.
6. If uncertain, returns `{ "translation": "UNCLEAR SIGN SEQUENCE", "status": "UNCERTAIN", "status_message": "..." }`.
7. `finally` block deletes the temporary file from `/tmp/`.

---

### 2.2 Health Endpoint (`GET /health`)

```bash
curl -s http://localhost:8001/health
```
```json
{
  "status": "healthy",
  "service": "SignVision Video Translation API (Local ISL ML)",
  "version": "2.0.0",
  "port": 8001,
  "engine_ready": true,
  "classes_count": 23,
  "threshold": 0.5,
  "min_hand_coverage": 0.5
}
```
