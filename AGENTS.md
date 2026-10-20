# SignVision — AGENTS.md

> **Operational rulebook and pragmatic guide for AI agents and software engineers contributing to the SignVision codebase.**

---

## ⚡ 1. Brief Rules & Invariants (TL;DR)

### The 7 Golden Rules
1. **Never Touch the CWASA HTML Template Unprompted**: `AvatarWebView.tsx` encapsulates a fragile WebGL bridge running external UEA Javascript logic. Do not modify its HTML wrapper or script tags unless explicitly requested.
2. **Preserve Dataset Symmetry**: Any modification to `data/sign_language_data.json` MUST be mirrored identically in `Application/src/data/sign_language_data.json` and vice-versa.
3. **No Heavy Native Dependencies**: Do NOT add MediaPipe, OpenCV, or PyTorch to the React Native app. Video inference is strictly offloaded to the Python microservice (`:8001`) via Gemini.
4. **Preserve Native Audio Bindings**: Do NOT replace `expo-speech-recognition` with Web Audio or browser APIs. Native Android/iOS permission lifecycles rely on these specific Expo native bindings.
5. **Strict TypeScript & Pydantic Type Sync**: Any change to backend FastAPI response schemas (`ProcessResponse`, `SignMatch`) must be mirrored immediately in `Application/src/types/index.ts`.
6. **No Wildcard CORS with Credentials**: Maintain `allow_credentials=False` whenever `allow_origins=["*"]` to prevent browser preflight CORS blocks.
7. **Always Bind to `0.0.0.0`**: Backend development servers must bind to `0.0.0.0` so mobile devices on the local Wi-Fi network can connect.

### Quick Verification Checklist

```bash
# 1. Verify Core Backend syntax & health
curl -s http://localhost:8000/health | grep '"status":"ok"'

# 2. Verify Video Microservice syntax & health
curl -s http://localhost:8001/health | grep '"status":"healthy"'

# 3. Verify Expo TypeScript compilation
cd Application && npx tsc --noEmit
```

---

## 🛠️ 2. Detailed Architecture & Engineering Standards

### 2.1 Project Overview & Component Topology
SignVision is a bidirectional Indian Sign Language (ISL) communication platform composed of:
- **Mobile/Web Client (`Application/`)**: React Native 0.83 / Expo SDK 55 managing state, video queues, speech input, and an embedded WebGL 3D avatar.
- **Core NLP Engine (`backend/`)**: FastAPI on port 8000 executing spaCy transformer POS analysis, NVIDIA LLM semantic extraction, ISL grammar transformations, and ChromaDB vector search.
- **Video Microservice (`video-service/`)**: FastAPI on port 8001 handling multipart video uploads and streaming inference through Google Gemini 3.6 Flash.
- **Cloud Asset Storage**: AWS S3 bucket (`signvision-085587597556`) in `ap-south-1` hosting 1,500+ `.sigml` XML files.

---

### 2.2 Frontend Conventions (`Application/`)

#### 1. Strict Typing
- All models reside in `Application/src/types/index.ts`.
- Avoid `any` or loose index signatures.
- API response handling must explicitly type incoming data against `ProcessResponse`.

#### 2. State & Ref Double-Buffering
- `HomeScreen.tsx` handles fast-moving animation sequences.
- Never rely exclusively on React state for sequential animation queues; React state updates are asynchronous and can cause dropped animation frames.
- Use the established **Ref Buffer Pattern**:
  ```typescript
  const signQueueRef = useRef<SignMatch[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  // Synchronously mutate signQueueRef.current, then trigger UI state update
  ```

#### 3. CWASA Avatar WebGL Bridge
- Communication with `AvatarWebView` occurs strictly over React Native WebView `postMessage()`:
  - **Play Sign**: `postMessage(JSON.stringify({ type: 'play', url: sigmlUrl }))`
  - **Stop Animation**: `postMessage(JSON.stringify({ type: 'stop' }))`
  - **Status Acknowledgement**: AvatarWebView emits `status` messages (`idle`, `playing`, `error`) back to the parent container.
- Do NOT remount `AvatarWebView` during active workflows; re-initializing WebGL incurs a noticeable 1–2 second GPU stall.

#### 4. UI/UX Design System
- Strictly adhere to the "Obsidian Slate" design system:
  - Background: `#07080D`
  - Elevated Surfaces: `#111722`
  - Accent / Success: `#10B981` (Emerald)
  - Secondary Accent: `#06B6D4` (Cyan)
  - Text Primary: `#F8FAFC`
  - Text Secondary: `#94A3B8`
- Use custom modular primitives from `Application/src/components/ui/` (`Button.tsx`, `Input.tsx`) rather than heavy third-party UI libraries.

---

### 2.3 Backend Conventions (`backend/` & `video-service/`)

#### 1. FastAPI & Pydantic Validation
- Every endpoint must use explicit Pydantic schemas for request bodies and response models.
- Never return raw Python dictionaries without validating against response models.
- Example:
  ```python
  @app.post("/process", response_model=ProcessResponse)
  async def process_text(request: ProcessRequest):
      ...
  ```

#### 2. NLP Pipeline Invariants
- `backend/app/core/nlp_engine.py` implements a sensitive 6-stage transformation pipeline:
  1. Input normalization
  2. Fixed expression detection
  3. Transformer POS tagging (`en_core_web_trf`)
  4. LLM semantic slot extraction (NVIDIA GPT-120b)
  5. ISL grammar rules (dropping articles/auxiliaries, shifting time to head, questions to end)
  6. GLOSS token assembly and multi-tier lookup
- Changes to grammar rules must be tested against sample sentences:
  - `"I am eating an apple"` $\rightarrow$ `["APPLE", "EAT"]`
  - `"Will you come tomorrow?"` $\rightarrow$ `["TOMORROW", "YOU", "COME", "QUESTION"]`

#### 3. Error Handling & Logging
- Keep standard HTTP exceptions unmasked using FastAPI's `HTTPException`.
- Log failures with contextual metadata (timestamp, input text length, stage of failure).
- Never silence exceptions in the NLP pipeline with blanket `try ... except: pass`.

---

### 2.4 Systematic Verification Workflow

Whenever making code modifications, follow this 4-step verification sequence:

1. **Type Contract Verification**:
   - Check that Python Pydantic models in `backend/app/main.py` match TypeScript interfaces in `Application/src/types/index.ts`.
2. **Backend Route Smoke Test**:
   - Test health endpoints with `curl`:
     ```bash
     curl -i http://localhost:8000/health
     curl -i http://localhost:8001/health
     ```
3. **Frontend Compilation Check**:
   - Verify TypeScript integrity in the frontend:
     ```bash
     cd Application && npx tsc --noEmit
     ```
4. **End-to-End Pipeline Verification**:
   - Send a test translation request:
     ```bash
     curl -s -X POST http://localhost:8000/process \
       -H "Content-Type: application/json" \
       -d '{"text": "Hello, how are you?"}'
     ```

---

*SignVision — Safe, predictable, and robust agentic engineering.*
