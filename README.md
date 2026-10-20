# 🤟 SignVision

> **Bridging the communication divide for 2.7+ million Deaf and Hard-of-Hearing individuals across India through bidirectional, AI-driven Indian Sign Language (ISL) translation.**

---

## ⚡ 1. Brief / Executive Summary (TL;DR)

SignVision is an intelligent, bidirectional translation platform that converts spoken and written English into Indian Sign Language (ISL) 3D avatar animations, and translates recorded ISL video streams back into natural English sentences.

### Core Capabilities
1. **Text & Voice → ISL (Forward Pipeline)**: Converts natural English speech or text into grammatically structured ISL GLOSS tokens, streaming 3D WebGL avatar animations via UEA CWASA and AWS S3 `.sigml` assets.
2. **Sign Video → English (Reverse Pipeline)**: Captures continuous ISL sign video from mobile cameras or web browsers and generates fluent English text using Google Gemini 3.6 Flash multimodal AI.
3. **Offline Word Dictionary**: Instant on-device sign lookup for 1,500+ words using character-bigram Dice similarity matching with zero network latency.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SignVision Architecture                            │
│                                                                             │
│   📱 Expo Mobile & Web App (Port 8081)                                      │
│      ├── CWASA 3D WebGL Avatar (SiGML Player)                               │
│      ├── Floating Ergonomic Composer (Text & Speech)                        │
│      └── Offline Word Dictionary (sign_language_data.json)                  │
│               │                                          │                  │
│       HTTP POST /process                         HTTP POST /translate-video │
│               ▼                                          ▼                  │
│   ⚙️ Core NLP Backend (:8000)                🎥 Video Microservice (:8001)  │
│      ├── spaCy Transformer POS                  └── Google Gemini 3.6 Flash │
│      ├── NVIDIA GPT-120b Semantic Extraction         Multimodal Vision      │
│      ├── ISL Grammar Rules Engine                        │                  │
│      └── ChromaDB Vector Search                          ▼                  │
│               │                                  Fluent English Text        │
│               ▼                                                             │
│   AWS S3 (.sigml files, ap-south-1)                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3-Terminal Quickstart Matrix

| Terminal | Service | Directory | Command | Port | URL / Docs |
|:---|:---|:---|:---|:---|:---|
| **Terminal 1** | **Core Backend (NLP)** | `backend/` | `source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload` | `8000` | http://localhost:8000/docs |
| **Terminal 2** | **Video Microservice** | `video-service/` | `source .venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8001 --reload` | `8001` | http://localhost:8001/health |
| **Terminal 3** | **Frontend (Expo)** | `Application/` | `npx expo start` *(or `npm run web` / `--dev-client`)* | `8081` | http://localhost:8081 |

---

## 🛠️ 2. Detailed Technical Guide & Engineering Manual

### 2.1 System Architecture & Microservice Decoupling

SignVision is engineered with clean microservice boundaries to optimize for distinct computational workloads:
- **Core Backend (`backend/`)**: CPU & NLP-intensive. Houses the spaCy transformer model (`en_core_web_trf`), ChromaDB vector store, and NVIDIA LLM client. Processes text/audio inputs into grammatical ISL GLOSS structures.
- **Video Microservice (`video-service/`)**: IO & Bandwidth-focused. Serves as a secure gateway for large multipart video streams (`.mp4` / `.webm`), piping them directly to Google Gemini's File API without intermediary transcoding bottlenecks.
- **Frontend Client (`Application/`)**: Universal Expo React Native application targeting Android, iOS, and Web. Operates as a thick client with local offline dictionary lookups and an embedded hardware-accelerated WebGL 3D avatar bridge.

---

### 2.2 Prerequisites & Environment Requirements

Ensure the following runtimes and toolchains are installed on the host machine:
- **Node.js**: v18.x or v20.x (LTS recommended)
- **Package Manager**: `npm` v9+ or `pnpm`
- **Python**: v3.10 or v3.11 (Python 3.12+ may encounter strict C-extension compile warnings for spaCy)
- **Virtual Environments**: `venv` configured for both backend services
- **Android SDK / EAS CLI** *(Optional, for Android APK builds)*: Java 17+, Android SDK build-tools 34+

---

### 2.3 Environment Variable Configuration

SignVision relies on environment variables for external API keys and local network binding. Copy `.env.example` at root:

```bash
cp .env.example .env
```

#### Key Variables in `.env`
```ini
# Core Backend (:8000)
# Get your free key at https://console.groq.com/keys
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-20b

# Optional: Groq fallback keys for automatic failover
GROQ_API_KEY_FALLBACK_1=
GROQ_API_KEY_FALLBACK_2=
GROQ_API_KEY_FALLBACK_3=

# Video Microservice (:8001)
SIGN_CONFIDENCE_THRESHOLD=0.50
MIN_HAND_COVERAGE=0.50

# Application Frontend (Application/ or root .env)
# For local web browser testing:
EXPO_PUBLIC_CORE_API_URL=http://localhost:8000
EXPO_PUBLIC_VIDEO_API_URL=http://localhost:8001

# For physical mobile device / Expo Go on local Wi-Fi:
# EXPO_PUBLIC_CORE_API_URL=http://192.168.1.100:8000
# EXPO_PUBLIC_VIDEO_API_URL=http://192.168.1.100:8001
```

> **Important**: When running on a physical Android/iOS device over Wi-Fi via Expo Go, replace `localhost` with your host computer's local network IPv4 address (e.g., `http://192.168.1.100:8000`).

---

### 2.4 Step-by-Step Installation & Bootstrapping

#### Step 1: Bootstrapping the Core Backend (Port 8000)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Download the transformer model for linguistic POS tagging
python -m spacy download en_core_web_trf

# (One-time) Generate ChromaDB vector embeddings for semantic fallback
python -c "from app.services.semantic_search import build_embeddings; build_embeddings()"

# Start the server bound to all network interfaces
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Step 2: Bootstrapping the Video Microservice (Port 8001)
```bash
cd video-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start the microservice bound to all interfaces
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

#### Step 3: Bootstrapping the Frontend Application (Port 8081)
```bash
cd Application
npm install

# Option A: Start in Web Browser (Chrome/Firefox)
npm run web
# or: npx expo start --web

# Option B: Run on Android Physical Device (via Custom Dev Client)
npx expo start --dev-client --clear
# Press 'a' in the terminal or scan the displayed QR code
```

---

### 2.5 API Endpoints & Request Contracts

#### Core Backend (`http://localhost:8000`)
- **`POST /process`**: Main NLP text-to-sign translation pipeline.
  ```json
  // Request
  { "text": "I am going to school tomorrow" }

  // Response (200 OK)
  {
    "gloss": {
      "tokens": ["TOMORROW", "I", "SCHOOL", "GO"],
      "sentence": "TOMORROW I SCHOOL GO"
    },
    "signs": [
      { "word": "TOMORROW", "url": "https://signvision-085587597556.s3.ap-south-1.amazonaws.com/sigml-files/tomorrow.sigml", "match_type": "exact" },
      { "word": "I", "url": "https://signvision-085587597556.s3.ap-south-1.amazonaws.com/sigml-files/i.sigml", "match_type": "exact" },
      { "word": "SCHOOL", "url": "https://signvision-085587597556.s3.ap-south-1.amazonaws.com/sigml-files/school.sigml", "match_type": "exact" },
      { "word": "GO", "url": "https://signvision-085587597556.s3.ap-south-1.amazonaws.com/sigml-files/go.sigml", "match_type": "exact" }
    ],
    "processing_time_ms": 312.4
  }
  ```
- **`GET /lookup/{word}`**: Individual word query with multi-tier fallback.
- **`GET /search?query={word}&top_k=5`**: ChromaDB vector similarity query.
- **`GET /health`**: Health status and dictionary capacity.

#### Video Microservice (`http://localhost:8001`)
- **`POST /api/translate-video`**: Accepts multipart video payloads (`.mp4` or `.webm`) and returns transcribed English text.
  ```json
  // Response (200 OK)
  {
    "translation": "WHAT IS YOUR NAME?"
  }
  ```
- **`GET /health`**: Microservice status check.

---

### 2.6 Cross-Origin Resource Sharing (CORS) Configuration

When testing via web browsers (`http://localhost:8081`), browser security strictly validates CORS preflight `OPTIONS` requests.
- **CORSMiddleware configuration**:
  Both backends have `allow_credentials=False` coupled with `allow_origins=["*"]`. Under the Fetch and CORS specification, setting `allow_credentials=True` alongside a wildcard `*` is strictly disallowed and triggers browser security blocks.
- **S3 Bucket CORS**:
  The S3 bucket `signvision-085587597556` has explicit CORS XML/JSON rules permitting `GET` and `HEAD` from `*` with allowed header `*` and max-age 3000 seconds.

---

### 2.7 Verification & Diagnostic Testing

Run these curl commands to verify your deployment:

```bash
# 1. Verify Core Backend Health
curl -s http://localhost:8000/health | jq .

# 2. Verify NLP Sentence Translation
curl -s -X POST http://localhost:8000/process \
  -H "Content-Type: application/json" \
  -d '{"text": "Where are you going?"}' | jq .

# 3. Verify Video Microservice Health
curl -s http://localhost:8001/health | jq .

# 4. Verify AWS S3 Asset Availability (Public HTTP 200)
curl -I https://signvision-085587597556.s3.ap-south-1.amazonaws.com/sigml-files/school.sigml
```

---

### 2.8 Common Troubleshooting

| Issue | Cause | Solution |
|:---|:---|:---|
| **CORS Request Did Not Succeed** | Web client blocked due to credentials or missing headers | Verify `backend/app/main.py` has `allow_credentials=False` and `allow_origins=["*"]`. |
| **Network Request Failed on Android** | Android treating `localhost` as device loopback | Update `Application/.env` to computer's Wi-Fi IPv4 address or run `adb reverse tcp:8000 tcp:8000`. |
| **Black Avatar Screen / Not Loading** | WebGL context lost or missing hardware acceleration | Verify hardware acceleration is enabled in `app.json`. Ensure remote CWASA scripts on UEA CDN can be resolved. |
| **404 / 403 on S3 `.sigml` files** | Bucket policy or regional redirect mismatch | Ensure regional endpoint `s3.ap-south-1.amazonaws.com` is used rather than legacy global endpoints. |
| **Microphone Permission Denied** | Missing Android/iOS manifest permissions | Ensure `expo-speech-recognition` plugin is registered in `app.json`. |

---

*SignVision — Empowering communication and independence through intelligent accessibility engineering.*
