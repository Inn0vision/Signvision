# SignVision — Video Microservice Technical Specification (`video-service_info.md`)

> **Technical specification for the Gemini 3.6 Flash multimodal video ingestion service, prompt architecture, and lifecycle management.**

---

## ⚡ 1. Brief Summary (TL;DR)

The Video Microservice (`video-service/`) runs on port 8001 and provides sign-to-English translation by interpreting continuous sign language video via Google Gemini 3.6 Flash multimodal AI.

### Technical Metrics
- **Runtime**: FastAPI / Uvicorn (Port 8001, bound to `0.0.0.0`)
- **Model**: `gemini-3.6-flash`
- **Supported Formats**: `.mp4` (Android/iOS hardware h.264), `.webm` (Web VP8/VP9)
- **Typical Latency**: 2.5s – 5.0s (depending on video duration and network upload speed)
- **Garbage Collection**: Deterministic cleanup of both local temporary files and remote Google File API assets.

---

## 🛠️ 2. Detailed Technical Specification

### 2.1 File Ingestion & Storage Pipeline

When a client submits a video via `POST /api/translate-video`, the service executes the following sequence:

```python
@app.post("/api/translate-video")
async def translate_video(video: UploadFile = File(...)):
    # 1. Generate unique temporary path
    ext = os.path.splitext(video.filename)[1] or ".mp4"
    temp_filename = f"/tmp/{uuid.uuid4()}{ext}"
    
    # 2. Stream multipart chunks to disk
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(video.file, buffer)
        
    try:
        # 3. Upload to Google GenAI File API
        uploaded_file = client.files.upload(file=temp_filename)
        
        # 4. Poll until video processing state is ACTIVE
        while uploaded_file.state.name == "PROCESSING":
            time.sleep(1)
            uploaded_file = client.files.get(name=uploaded_file.name)
            
        if uploaded_file.state.name == "FAILED":
            raise HTTPException(status_code=500, detail="Video processing failed")
            
        # 5. Multimodal Inference
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=[uploaded_file, PROMPT]
        )
        return {"translation": response.text.strip()}
        
    finally:
        # 6. Guaranteed Cleanup
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
        if uploaded_file:
            client.files.delete(name=uploaded_file.name)
```

---

### 2.2 Multimodal Sign Recognition Dynamics

Gemini 3.6 Flash analyzes sign language through multi-feature correlation:
1. **Manual Features**:
   - **Handshape / Configuration**: Finger flexion, thumb opposition, contact points.
   - **Orientation**: Palm direction, wrist rotation relative to the torso.
   - **Location**: Articulation zone (head, chest, neutral space).
   - **Movement Trajectory**: Linear, circular, or repetitive spatial paths.
2. **Non-Manual Features**:
   - Facial expressions conveying grammatical polarity, question markers, and emotional tone.
   - Head tilts and shoulder shifts indicating topicalization and contrast.

---

### 2.3 Error Handling & Fallbacks

- **Ambiguous Gestures**: If the signer's hand shapes or movements are indistinct or not recognized as valid ISL, the model returns `"UNCLEAR SIGN SEQUENCE"`.
- **Upload Failures**: If the video is corrupted or encoded in an unsupported format, the server returns an HTTP 400 Bad Request.
- **Quota / Rate Limits**: If Google's API returns HTTP 429, the service catches the exception and returns an HTTP 503 Service Unavailable with a client retry recommendation.

---

### 2.4 Health & Telemetry Endpoint (`GET /health`)

```bash
curl -s http://localhost:8001/health
```
```json
{
  "status": "healthy",
  "service": "SignVision Video Translation API",
  "version": "1.0.0"
}
```

---

*SignVision — Video Microservice Technical Specification.*
