# SignVision — Master Consolidated Reference Manual

> **Consolidated master documentation covering all system layers, operational workflows, configuration dictionaries, and architectural contracts.**

---

## ⚡ 1. Brief Executive Snapshot (TL;DR)

SignVision is an end-to-end accessibility platform providing bidirectional communication between spoken/written English and Indian Sign Language (ISL).

### Platform at a Glance
- **Client**: Universal Expo SDK 55 / React Native 0.83 app with embedded CWASA WebGL 3D Avatar and native audio/video recording.
- **Core Backend (`:8000`)**: FastAPI server executing a 6-stage NLP pipeline (spaCy transformer, NVIDIA GPT-120b, ISL grammar rules, ChromaDB vector search).
- **Video Microservice (`:8001`)**: FastAPI server streaming camera recordings to Google Gemini 3.6 Flash for sign-to-English translation.
- **Asset Storage**: AWS S3 (`ap-south-1`) serving 1,500+ `.sigml` XML motion files.
- **Offline Fallback**: Bundled 1,500-word JSON dictionary with character-bigram Dice similarity matching.

### Port & Service Map

| Service | Port | Host Binding | Primary Endpoint | Description |
|:---|:---|:---|:---|:---|
| **Frontend** | `8081` | `0.0.0.0` | `/` | Web & Metro bundler for mobile |
| **Core Backend** | `8000` | `0.0.0.0` | `/process` | English to ISL GLOSS translation |
| **Video Microservice** | `8001` | `0.0.0.0` | `/api/translate-video` | ISL Video to English translation |
| **Cloud Storage** | `443` | AWS CDN | `https://signvision-085587597556.s3.ap-south-1.amazonaws.com/` | Public S3 bucket hosting `.sigml` assets |

---

## 📖 2. Detailed Master Reference

### 2.1 Complete Directory Taxonomy

```
Signvision/
├── Application/                   # Mobile & Web Client (Expo React Native)
│   ├── src/
│   │   ├── components/            # UI components (AvatarWebView, SearchBar, ui/Button, ui/Input)
│   │   ├── screens/               # Screen containers (HomeScreen, CameraTranslateScreen)
│   │   ├── services/              # API and S3 data clients (apiService, s3Service)
│   │   ├── types/                 # Shared TypeScript interfaces
│   │   └── data/                  # Bundled sign dictionary (sign_language_data.json)
│   ├── app.json                   # Expo application manifest
│   ├── package.json               # Frontend dependencies
│   ├── README.md                  # Frontend development manual
│   ├── Application_info.md        # Technical component specification
│   └── troubleshoots.md           # Mobile & web troubleshooting cheat sheet
│
├── backend/                       # Core NLP Engine (FastAPI @ :8000)
│   ├── app/
│   │   ├── core/                  # config.py, nlp_engine.py
│   │   ├── services/              # word_lookup.py, semantic_search.py
│   │   └── main.py                # API router and middleware
│   ├── requirements.txt           # Python backend dependencies
│   ├── README.md                  # Backend setup and endpoint guide
│   └── backend_info.md            # In-depth NLP engine documentation
│
├── video-service/                 # Video AI Translation Service (FastAPI @ :8001)
│   ├── main.py                    # Gemini 3.6 Flash multimodal API integration
│   ├── requirements.txt           # Video service dependencies
│   ├── README.md                  # Video service developer guide
│   ├── video-service_info.md      # Multimodal inference specification
│   └── frontend.md                # CameraView & gesture overlay guide
│
├── data/                          # Master sign dictionary & offline raw assets
│   ├── sign_language_data.json    # Master word-to-SiGML JSON mapping
│   ├── Initial-sigml-files/       # Raw XML SiGML gesture descriptions
│   └── data_info.md               # Data schema specification
│
├── dataset/                       # Source vocabulary datasets
│   ├── a.json ... z.json          # Alphabetical sign definitions
│   ├── numbers.json               # Numerical sign definitions
│   └── dataset_info.md            # Linguistic annotations manual
│
├── feats/                         # Semantic search prototypes
│   ├── Semantic-search/           # ChromaDB standalone embeddings & CLI
│   └── feats_info.md              # Feature experimentation guide
│
├── docs/                          # Architectural documentation & audit reports
│   ├── component_matrix.md        # Universal component selection matrix
│   ├── design_system_specification.md # Color tokens & motion physics
│   ├── frontend_audit.md          # UI/UX defect analysis & remediation
│   ├── implementation_plan.md     # Master documentation plan
│   └── docs_info.md               # Docs catalog
│
├── README.md                      # Repository entry point
├── PROJECT_INFO.md                # System specification & metrics
├── AGENTS.md                      # Operational rulebook for agents & engineers
├── arch.md                        # Architecture blueprints & sequence diagrams
├── design.md                      # Design system & UI/UX specification
├── build.md                       # Build & packaging manual
├── WIFI_DEVELOPMENT_GUIDE.md      # Wireless debugging manual
└── info.md                        # This master reference document
```

---

### 2.2 Cross-Cutting System Invariants

1. **Dataset Mirroring**: Whenever `data/sign_language_data.json` is modified, the copy at `Application/src/data/sign_language_data.json` must be updated identically.
2. **Avatar WebView Immutability**: The WebGL container in `AvatarWebView.tsx` must remain mounted across navigation transitions to avoid GPU context recreation overhead.
3. **No Heavy Native ML on Mobile**: Continuous computer vision inference is handled server-side via FastAPI and Gemini, avoiding bloated native libraries.
4. **CORS Security**: Both FastAPI services set `allow_credentials=False` when using `allow_origins=["*"]` to ensure compatibility with modern browser security standards.
5. **Local Network Binding**: All servers listen on `0.0.0.0` to permit physical mobile device connectivity across the local subnet.

---

*SignVision — Comprehensive technical reference manual.*
