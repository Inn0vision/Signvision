# SignVision Video Translation Microservice (`video-service/`)

> **FastAPI microservice translating Indian Sign Language (ISL) video recordings into natural English sentences using Google Gemini 3.6 Flash multimodal AI.**

---

## ⚡ 1. Brief Quickstart & Endpoints (TL;DR)

### Quick Commands

```bash
# 1. Setup virtual environment & dependencies
cd video-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 2. Export Gemini API Key
export GEMINI_API_KEY="your-gemini-api-key"

# 3. Start the FastAPI server on port 8001
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### Key API Endpoints

| Method | Endpoint | Description | Payload | Response |
|:---|:---|:---|:---|:---|
| `GET` | `/health` | Microservice health check | None | `{"status": "healthy", "service": "..."}` |
| `POST` | `/api/translate-video` | ISL video translation | Multipart `video` file (`.mp4`, `.webm`) | `{"translation": "HELLO"}` |

---

## 🛠️ 2. Detailed Technical Specification

### 2.1 Microservice Architecture

The video service is intentionally decoupled from the core NLP backend to isolate high-bandwidth multipart I/O and streaming video processing from CPU-bound linguistic processing:

```
[Mobile/Web Client]
       │
       ▼ (Multipart POST /api/translate-video)
[FastAPI on Port 8001]
       │
       ▼ (Saves buffer to /tmp/temp_<uuid>.<ext>)
[Local Storage Buffer]
       │
       ▼ (Streams bytes via google-genai File API)
[Google GenAI Client]
       │
       ▼
[Gemini 3.6 Flash] ────────► Multimodal Video Analysis
       │                     - Handshapes & finger configurations
       │                     - Spatial trajectory & movement dynamics
       │                     - Facial expressions & grammatical non-manuals
       │
       ▼
[Prompt Constraint] ────────► Returns direct English translation
       │                     or "UNCLEAR SIGN SEQUENCE"
       ▼
[FastAPI Response] ─────────► { "translation": "..." }
       │
       ▼ (finally block)
[Cleanup /tmp/ Buffer]
```

---

### 2.2 Configuration & Dependencies

#### Python Dependencies (`requirements.txt`)
- `fastapi`: High-performance asynchronous web framework.
- `uvicorn`: ASGI web server.
- `python-multipart`: Streaming multipart form-data parser for video uploads.
- `google-genai`: Official Google Gemini SDK supporting multimodal File API uploads.
- `python-dotenv`: Environment variable loader.

#### Environment Variables
```ini
GEMINI_API_KEY=your_google_gemini_api_key_here
```

---

### 2.3 Video Processing & Prompt Engineering

The service instructs Gemini 3.6 Flash with a specialized accessibility prompt:

```python
PROMPT = """
You are an expert Indian Sign Language (ISL) interpreter.
Analyze this video of a person performing Indian Sign Language signs.
Translate the signs into a clear, natural English sentence.

Rules:
1. Provide ONLY the translated English sentence.
2. Do not include explanations, notes, or descriptions of the signs.
3. If the signs are unclear, incomplete, or not ISL, respond with "UNCLEAR SIGN SEQUENCE".
4. Preserve the intended meaning and tone of the signer.
"""
```

#### Lifecycle & Garbage Collection
1. **Streaming Upload**: Inbound video frames are streamed into a temporary file on the local filesystem (`/tmp/`).
2. **File API Upload**: The file is uploaded to Google's GenAI File service via `client.files.upload()`.
3. **State Polling**: The service waits until the video processing state shifts to `ACTIVE`.
4. **Content Generation**: Generates content using `model="gemini-3.6-flash"`.
5. **Deterministic Cleanup**: A `finally` block guarantees that both the local `/tmp/` file and the remote Google File API asset are deleted to prevent storage leaks.

---

### 2.4 CORS Configuration (`main.py`)

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Enforces compliance with W3C Fetch spec for wildcard origins
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

### 2.5 Verification & Testing

```bash
# 1. Healthcheck
curl -s http://localhost:8001/health | jq .

# 2. Test Video Translation with sample video
curl -s -X POST http://localhost:8001/api/translate-video \
  -F "video=@sample_sign.mp4;type=video/mp4" | jq .
```

---

*SignVision — Video Translation Microservice Documentation.*
