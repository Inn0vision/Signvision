# SignVision — Master Implementation Plan (`docs/implementation_plan.md`)

> **Architectural implementation roadmap, phase deliverables, verification gates, and production handoff criteria.**

---

## ⚡ 1. Brief Roadmap (TL;DR)

### Implementation Phases at a Glance

| Phase | Milestone | Core Objective | Status |
|:---|:---|:---|:---|
| **Phase 1** | Foundation & S3 Sync | Provision AWS S3 bucket (`ap-south-1`) & migrate 1,500+ `.sigml` assets | ✅ Complete |
| **Phase 2** | Core NLP Engine | Implement 6-stage NLP pipeline & ChromaDB semantic search on port 8000 | ✅ Complete |
| **Phase 3** | Video Microservice | Multimodal video-to-English translation via Gemini 3.6 Flash on port 8001 | ✅ Complete |
| **Phase 4** | Universal UI Overhaul | "Obsidian Slate" design system, floating composer, custom UI primitives | ✅ Complete |
| **Phase 5** | Bug & Defect Hardening| Fix CORS headers (`allow_credentials=False`), layout collisions, ref-buffering | ✅ Complete |
| **Phase 6** | Documentation Audit | Overhaul all 25+ markdown files with dual brief and detailed perspectives | ✅ Complete |

---

## 🛠️ 2. Detailed Technical Implementation Plan

### 2.1 Phase-by-Phase Technical Specifications

#### Phase 1: Storage Layer & Regional S3 Routing
- Provisioned Amazon S3 bucket `signvision-085587597556` in the `ap-south-1` (Mumbai) region.
- Configured public read bucket policy and permissive Cross-Origin Resource Sharing (`CORSConfiguration`) allowing `GET` and `HEAD` from `*`.
- Synchronized all 1,500+ `.sigml` XML motion files from `data/Initial-sigml-files/` to `s3://signvision-085587597556/sigml-files/`.
- Updated base URLs across both `data/sign_language_data.json` and `Application/src/data/sign_language_data.json`.

#### Phase 2: Core NLP Engine (`backend/`)
- Integrated spaCy transformer pipeline (`en_core_web_trf`) for accurate POS tagging and dependency analysis.
- Connected NVIDIA API (`openai/gpt-oss-120b`) for semantic slot extraction (`subject`, `action`, `object`, `time`, `negation`, `question_type`).
- Formulated deterministic ISL grammar rules (SOV reordering, time fronting, interrogative tailing, copula removal).
- Built persistent ChromaDB vector store using `sentence-transformers/all-MiniLM-L6-v2` for Tier 4 fuzzy semantic fallback.

#### Phase 3: Video Translation Microservice (`video-service/`)
- Decoupled video processing onto FastAPI port 8001.
- Implemented streaming multipart file ingestion with disk buffering in `/tmp/`.
- Utilized Google GenAI SDK to upload video files directly to Gemini's File API.
- Employed `gemini-3.6-flash` with strict accessibility prompt to translate continuous ISL gestures to fluent English sentences.
- Ensured deterministic cleanup of temporary files in `finally` blocks.

#### Phase 4: Universal Mobile & Web UI Overhaul (`Application/`)
- Re-skinned application in the "Obsidian Slate" palette (`#07080D` canvas, `#111722` surface, `#10B981` emerald, `#06B6D4` cyan).
- Created modular, accessible UI primitives inspired by `shadcn/ui` (`Button.tsx`, `Input.tsx`).
- Anchored the floating composer to the thumb-zone (bottom 35% of viewport) with native `KeyboardAvoidingView`.
- Stabilized CWASA WebGL 3D Avatar inside `AvatarWebView.tsx`, maintaining persistent WebGL context across navigation.

#### Phase 5: Defect Hardening & Production Polish
- Corrected W3C Fetch CORS violation by setting `allow_credentials=False` alongside `allow_origins=["*"]`.
- Solved layout collisions in `HomeScreen.tsx` by stacking the search history tray above the mode selector.
- Implemented the Ref-Buffer pattern (`signQueueRef`) to eliminate animation frame drops during rapid playback.

#### Phase 6: Repository-Wide Documentation Audit
- Updated all Markdown documentation files across the codebase to provide both a rapid-reference **Brief** perspective (TL;DR, tables, quick commands) and an exhaustive **Detailed** perspective (architectural diagrams, code walkthroughs, edge cases).

---

### 2.2 Verification & Release Checklist

- [x] Backend syntax & health check (`GET http://localhost:8000/health`)
- [x] Video service health check (`GET http://localhost:8001/health`)
- [x] Frontend TypeScript compilation (`npx tsc --noEmit`)
- [x] Public S3 asset accessibility (`curl -I https://signvision-085587597556.s3.ap-south-1.amazonaws.com/sigml-files/school.sigml`)
- [x] Cross-origin requests from web client (`POST /process`)
- [x] Consistent documentation across all modules

---

*SignVision — Master Implementation Plan.*
