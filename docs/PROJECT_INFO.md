# SignVision — Project Information & System Specification

> **A comprehensive technical profile, architecture specification, and component blueprint for the SignVision platform.**

---

## ⚡ 1. Brief Summary (TL;DR)

SignVision is a full-stack, AI-powered accessibility platform delivering real-time bidirectional translation between English (speech/text) and Indian Sign Language (ISL).

### Quick Facts & System Metrics
- **Mission**: Universal communication for 2.7M+ Deaf and Hard-of-Hearing individuals in India.
- **Form Factors**: Native Android APK (Custom Dev Client), iOS (EAS Build), Desktop/Mobile Web (Chrome/Firefox).
- **Core Dictionary**: 1,500+ pre-compiled ISL signs stored as `.sigml` XML motion assets on AWS S3 (`ap-south-1`).
- **AI Pipelines**:
  - **Forward**: Text/Speech $\rightarrow$ spaCy `en_core_web_trf` $\rightarrow$ NVIDIA GPT-120b $\rightarrow$ ISL Grammar Rules $\rightarrow$ 3D CWASA WebGL Avatar.
  - **Reverse**: Camera Video Stream $\rightarrow$ FastAPI Microservice $\rightarrow$ Google Gemini 3.6 Flash $\rightarrow$ Natural English Text.
- **Offline Capability**: On-device dictionary lookup via bundled JSON with character-bigram Dice similarity matching.

### Service & Routing Matrix

| Service | Port | Protocols | Endpoints | Primary Technology |
|:---|:---|:---|:---|:---|
| **Frontend** | `8081` | HTTP, WS (Metro) | Static Web App, React Native bundle | Expo, React Native 0.83, TypeScript |
| **Core NLP Backend** | `8000` | HTTP REST, JSON | `/process`, `/transcribe`, `/lookup/{w}`, `/search`, `/health` | Python, FastAPI, spaCy, ChromaDB |
| **Video Microservice** | `8001` | HTTP REST, Multipart | `/api/translate-video`, `/health` | Python, FastAPI, Google GenAI SDK |
| **Asset Cloud** | `443` | HTTPS | `https://signvision-085587597556.s3.ap-south-1.amazonaws.com/` | AWS S3 Public Read + Wildcard CORS |

---

## 🏗️ 2. Detailed Technical Specification

### 2.1 Full System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SignVision Platform                               │
│                                                                             │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │               Client Application Layer (Expo RN @ :8081)             │  │
│   │                                                                      │  │
│   │   [SearchBar.tsx]           [HomeScreen.tsx]     [AvatarWebView.tsx] │  │
│   │   - Speech-to-Text Input    - State Controller   - Embedded WebGL    │  │
│   │   - Floating Composer       - Queue Ref Buffer   - CWASA Engine      │  │
│   │   - Autocomplete Engine     - History Tracking   - SiGML XML Player  │  │
│   │          │                          │                    ▲           │  │
│   │          └──────────────┬───────────┘                    │           │  │
│   │                         ▼                                │           │  │
│   │              [s3Service.ts] (Offline)                    │           │  │
│   │              - Dice Bigram Matcher                       │           │  │
│   │              - 1,500+ Bundled Words                      │           │  │
│   │                         │                                │           │  │
│   │                         ▼                                │           │  │
│   │              [apiService.ts] (Online)                    │           │  │
│   │              - Exponential Backoff Client                │           │  │
│   │              - AbortController Timeouts                  │           │  │
│   └─────────────────────────┼────────────────────────────────┼───────────┘  │
│                             │                                │              │
│                 HTTP POST   │                    Direct      │ HTTPS Fetch  │
│                 /process    │                    SiGML URL   │ .sigml       │
│                             ▼                                ▼              │
│   ┌─────────────────────────────────────────┐   ┌────────────────────────┐  │
│   │   Core NLP AI Backend (FastAPI @ :8000) │   │     Storage Layer      │  │
│   │                                         │   │                        │  │
│   │   1. Preprocessing & Normalization      │   │  AWS S3 (ap-south-1)   │  │
│   │   2. Fixed Phrase Short-circuit         │   │  Bucket:               │  │
│   │   3. spaCy en_core_web_trf POS Analysis │   │  signvision-           │  │
│   │   4. NVIDIA GPT-120b Semantic Extraction│   │  085587597556          │  │
│   │   5. ISL Grammar Rule Engine            │   │                        │  │
│   │   6. GLOSS Assembly & Word Lookup       │   │  ChromaDB (Local)      │  │
│   │   7. ChromaDB Vector Fallback           │   │  all-MiniLM-L6-v2      │  │
│   └─────────────────────────────────────────┘   └────────────────────────┘  │
│                                                              ▲              │
│                 HTTP POST /api/translate-video               │              │
│                 (.mp4 / .webm video multipart)               │              │
│                             │                                │              │
│                             ▼                                │              │
│   ┌──────────────────────────────────────────────────────────┴───────────┐  │
│   │            Video Vision Microservice (FastAPI @ :8001)               │  │
│   │                                                                      │  │
│   │   - Multipart File Buffer Streamer                                   │  │
│   │   - Google GenAI SDK (Client)                                        │  │
│   │   - Gemini 3.6 Flash Multimodal Video Ingestion                      │  │
│   │   - ISL Handshape, Orientation, & Motion Interpretation              │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Microservices & Directory Structure

```
Signvision/
├── Application/                 # Universal Expo React Native mobile & web app
│   ├── src/
│   │   ├── components/          # UI components (AvatarWebView, SearchBar, ui/Button, ui/Input)
│   │   ├── screens/             # Screen containers (HomeScreen, CameraTranslateScreen)
│   │   ├── services/            # Client services (apiService, s3Service)
│   │   ├── types/               # Single-source-of-truth TypeScript definitions
│   │   └── data/                # Bundled sign_language_data.json dictionary
│   ├── app.json                 # Expo config (permissions, Android package, plugins)
│   └── package.json             # NPM dependencies
│
├── backend/                     # Core NLP translation engine (FastAPI @ :8000)
│   ├── app/
│   │   ├── core/                # config.py (Pydantic Settings), nlp_engine.py (6-stage NLP)
│   │   ├── services/            # word_lookup.py, semantic_search.py
│   │   └── main.py              # FastAPI application router & CORS setup
│   └── requirements.txt         # Python dependencies
│
├── video-service/               # Video-to-English translation microservice (FastAPI @ :8001)
│   ├── main.py                  # Gemini 3.6 Flash multimodal API integration
│   └── requirements.txt         # Python dependencies (google-genai, fastapi, uvicorn)
│
├── data/                        # Master data repository
│   ├── sign_language_data.json  # Master dictionary mapping gloss tokens to S3 URLs
│   └── Initial-sigml-files/     # Offline raw XML SiGML gesture descriptions
│
├── dataset/                     # Alphabetical sign source datasets (a.json - z.json, numbers)
├── feats/                       # Semantic search prototypes & embeddings generator
└── docs/                        # Specifications, component matrices, audits, and plans
```

---

### 2.3 Detailed Data Flows

#### Flow 1: Offline Word Mode (Latency: < 50ms)
1. User enters a single word (e.g., `"SCHOOL"`).
2. `s3Service.lookupWord()` standardizes the input to uppercase.
3. Performs a 4-tier check:
   - **Exact match**: Direct key lookup in the local 1,500-word dictionary.
   - **Anchor match**: Matches synonym arrays (e.g., `"AEROPLANE"` $\rightarrow$ `"AIRPLANE"`).
   - **Partial match**: Substring containment check.
   - **Fuzzy fallback**: Calculates character-bigram Dice coefficient similarity to suggest close alternatives.
4. Returns the verified AWS S3 `.sigml` URL.
5. `AvatarWebView` sends a `play` message to the CWASA WebGL canvas.
6. The 3D avatar renders the sign animation immediately.

#### Flow 2: Online Sentence Mode (Latency: 300ms – 1.2s)
1. User enters or speaks an English sentence (e.g., `"I will not go to school"`).
2. `apiService.processSentence()` issues `POST http://<HOST>:8000/process`.
3. The Core NLP Engine executes its 6-stage pipeline:
   - **Preprocessing**: Lowercasing, contraction expansion (`"won't"` $\rightarrow$ `"will not"`), sentence segmentation.
   - **Fixed Expressions**: Instant pattern matching for standard phrases (`"thank you"` $\rightarrow$ `[THANKYOU]`).
   - **Linguistic Analysis**: spaCy `en_core_web_trf` tags part-of-speech (POS) and syntactic dependencies.
   - **Semantic Extraction**: NVIDIA GPT-120b extracts structured entities: Subject, Object, Verb, Tense, Negation, Question Type.
   - **ISL Grammar Transform**: Drops articles (`a`, `an`, `the`) and auxiliary verbs (`am`, `is`, `are`), moves time markers to the head (`FUTURE`), shifts WH-words to the sentence end, and appends negation (`NOT`).
   - **GLOSS Assembly**: Produces ISL syntax: `[FUTURE, I, SCHOOL, GO, NOT]`.
4. The Gloss tokens are matched to S3 URLs via `WordLookupService` (with ChromaDB semantic vector fallback).
5. Frontend receives the response, enqueues the signs in `HomeScreen`, and plays them sequentially through the 3D avatar.

#### Flow 3: Sign-to-English Video Translation (Latency: 2.5s – 5.0s)
1. User holds the record button in `CameraTranslateScreen` to capture 5–8 seconds of sign gestures.
2. Web uses `MediaRecorder` (`video/webm`); Android/iOS uses `Expo CameraView` (`video/mp4`).
3. Payload is uploaded via multipart `POST http://<HOST>:8001/api/translate-video`.
4. FastAPI buffers the video to a temporary path (`/tmp/`) and streams it to Google Gemini 3.6 Flash via `google-genai` File API.
5. Gemini processes the video with an accessibility prompt instructed to evaluate ISL handshapes, facial markers, and movement trajectories.
6. Returns natural English text (`"What are you doing?"`) or `"UNCLEAR SIGN SEQUENCE"` if the sign was ambiguous.
7. Frontend displays the natural translation result card with an option to sign again.

---

### 2.4 Technologies & Dependencies

| Area | Technology | Version | Key Justification |
|:---|:---|:---|:---|
| **Mobile Runtime** | Expo / React Native | SDK 55 / RN 0.83 | Universal compilation across Android, iOS, and Web; native speech integration |
| **Speech Recognition** | `expo-speech-recognition` | 3.2.x | Native device bindings (`SpeechRecognizer` / `SFSpeechRecognizer`) with interim transcripts |
| **3D Avatar** | UEA CWASA (WebGL/SiGML) | 2020 CWA release | Mature, research-grade ISL bone animation library; zero native 3D engine overhead |
| **Backend Framework** | FastAPI | 0.104+ | Native async I/O, automatic OpenAPI docs, Pydantic type validation |
| **Linguistic NLP** | spaCy | 3.7+ (`en_core_web_trf`) | Transformer-based tokenization and POS tagging for grammatically ambiguous inputs |
| **Semantic AI** | NVIDIA API (GPT-120b) | `openai/gpt-oss-120b` | High-parameter reasoning model for semantic slot extraction |
| **Vector Database** | ChromaDB | 0.4+ | Embedded in-process vector store with HNSW indexing for nearest-neighbor lookups |
| **Embeddings** | `sentence-transformers` | 2.2+ (`all-MiniLM-L6-v2`) | 384-dimensional dense semantic vectors running efficiently on CPU |
| **Video AI** | Google Gemini | `gemini-3.6-flash` | State-of-the-art multimodal vision understanding for continuous video gestures |
| **Cloud Storage** | AWS S3 | `ap-south-1` (Mumbai) | Global CDN-class delivery of XML `.sigml` animation files |

---

### 2.5 Security, Privacy & Network Boundaries
- **No Hardcoded Secrets**: All API keys (`GPT_API_KEY`, `GEMINI_API_KEY`, AWS credentials) are loaded from environment variables via `pydantic-settings` or `.env`.
- **CORS Standards**: Wildcard origins (`allow_origins=["*"]`) are configured with `allow_credentials=False` to strictly comply with browser security models.
- **Local Network Wi-Fi Binding**: Both backends bind to `0.0.0.0` so mobile devices on the same subnet can access the endpoints without requiring USB tethering.

---

*SignVision — Engineered for performance, accuracy, and accessibility.*
