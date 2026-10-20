# SignVision — System Architecture & Data Flow Specification

> **Architectural blueprint detailing service topology, inter-process communication, neural pipelines, and storage layers.**

---

## ⚡ 1. Brief Architecture Overview (TL;DR)

SignVision is structured as a decoupled tri-tier system:
1. **Frontend Tier (`Application/`)**: React Native / Expo application hosting an embedded CWASA WebGL 3D Avatar, local offline dictionary, and native audio/video capture.
2. **Core NLP Backend (`backend/`)**: FastAPI server on port 8000 orchestrating spaCy transformer POS analysis, NVIDIA LLM semantic extraction, ISL grammar transformations, and ChromaDB vector search.
3. **Video Microservice (`video-service/`)**: FastAPI server on port 8001 streaming multipart video recordings directly to Google Gemini 3.6 Flash for sign-to-English translation.
4. **Cloud Storage Tier**: AWS S3 bucket `signvision-085587597556` in `ap-south-1` serving 1,500+ `.sigml` XML files.

```
+-----------------------------------------------------------------------------------+
|                                  SIGNVISION TOPOLOGY                              |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                  EXPO FRONTEND CLIENT (PORT 8081)                           |  |
|  |                                                                             |  |
|  |  [Speech/Text Input]        [State & Ref Buffer]     [CWASA WebGL Avatar]   |  |
|  |         |                            |                         ^            |  |
|  |         +-------------+--------------+                         |            |  |
|  |                       |                                        |            |  |
|  |               (Offline Word Mode)                              |            |  |
|  |                       v                                        |            |  |
|  |             [s3Service: 1.5k Words]                            |            |  |
|  |             - Exact, Anchor, Bigram                            |            |  |
|  |                       |                                        |            |  |
|  |                       +----------------------------------------+            |  |
|  +-----------------------|----------------------------------------|------------+  |
|                          | (Sentence Mode)                        | (Video Mode)  |
|                          | POST /process                          | POST /trans.. |
|                          v                                        v               |
|  +-------------------------------------+   +-----------------------------------+  |
|  |       CORE NLP BACKEND (:8000)      |   |    VIDEO MICROSERVICE (:8001)     |  |
|  |                                     |   |                                   |  |
|  |  1. Preprocessing & Normalization   |   |  - Multipart Video Ingestion      |  |
|  |  2. Fixed Expression Short-circuit  |   |  - Google GenAI Client            |  |
|  |  3. spaCy en_core_web_trf POS      |   |  - Gemini 3.6 Flash Inference     |  |
|  |  4. NVIDIA GPT-120b Semantic Slots  |   |  - Handshape & Trajectory Analysis|  |
|  |  5. ISL Grammar Rule Engine         |   +-----------------+-----------------+  |
|  |  6. GLOSS Assembly & Word Lookup    |                     |                    |
|  |  7. ChromaDB (all-MiniLM-L6-v2)     |                     | (English Output)   |
|  +-------------------+-----------------+                     v                    |
|                      |                            [Fluent English Text]           |
|                      v                                                            |
|          +-----------------------+                                                |
|          |  AWS S3 (ap-south-1)  |                                                |
|          |  1,500+ .sigml Assets |                                                |
|          +-----------------------+                                                |
+-----------------------------------------------------------------------------------+
```

---

## 🛠️ 2. Detailed Technical Architecture

### 2.1 Forward Pipeline: Spoken/Written English $\rightarrow$ 3D Avatar (Port 8000)

The forward pipeline converts unrestricted English sentences into grammatically sound Indian Sign Language GLOSS tokens and animated 3D avatar movements.

```
[User Text/Voice]
       │
       ▼
[1. Preprocessing] ────────► Lowercase, strip punctuation, expand contractions
       │
       ▼
[2. Fixed Expressions] ────► Match idioms/greetings (e.g., "how are you" -> [HOW, YOU])
       │
       ▼
[3. spaCy Transformer] ────► POS tagging & dependency parse (en_core_web_trf)
       │
       ▼
[4. NVIDIA GPT-120b] ──────► Semantic slot extraction (Subject, Object, Verb, Tense)
       │
       ▼
[5. ISL Grammar Engine] ───► Transform SOV, front time adverbs, shift interrogatives
       │
       ▼
[6. Gloss Assembly] ───────► Assemble GLOSS tokens (e.g., [TOMORROW, I, SCHOOL, GO])
       │
       ▼
[7. Multi-Tier Lookup] ────► Tier 1: Exact Match -> Tier 2: Anchor Match
       │                     Tier 3: Partial Match -> Tier 4: ChromaDB Embedding
       ▼
[Response to Client] ──────► Returns JSON with GLOSS tokens + S3 .sigml URLs
```

#### The 6 NLP Stages in Detail
1. **Input Normalization**: Expands contracted forms (`"I'm"` $\rightarrow$ `"I am"`), trims excessive whitespace, and standardizes punctuation.
2. **Fixed Expressions Detection**: Instant pattern matching for standard conversational idioms (`"Good morning"`, `"Thank you"`, `"Nice to meet you"`), bypassing the transformer pipeline to minimize latency.
3. **Transformer POS Tagging**: Utilizes spaCy's `en_core_web_trf` (RoBERTa-based) for high-accuracy POS tagging and syntactic dependency parsing.
4. **LLM Semantic Slot Extraction**: Queries NVIDIA's hosted `openai/gpt-oss-120b` endpoint with a specialized system prompt, extracting core semantic components:
   - `subject`: Primary actor
   - `object`: Target entity
   - `action`: Core verb / predicate
   - `time`: Temporal markers (`yesterday`, `tomorrow`, `now`)
   - `negation`: Boolean flag (`not`, `never`)
   - `question_type`: Categorization (`wh_question`, `yes_no`, `none`)
5. **ISL Grammar Rule Transformations**:
   - **Structure**: Converts English SVO (Subject-Verb-Object) to ISL SOV (Subject-Object-Verb).
   - **Time Topicalization**: Moves temporal tokens to the beginning of the sentence (`"I went yesterday"` $\rightarrow$ `"YESTERDAY I GO"`).
   - **Interrogative Positioning**: Moves question markers (`WHAT`, `WHERE`, `WHO`, `WHY`) to the end of the sentence.
   - **Auxiliary Removal**: Strips copulas and auxiliaries (`is`, `am`, `are`, `was`, `were`, `the`, `a`, `an`).
   - **Negation Appending**: Moves negative markers to the end of the verbal phrase.
6. **GLOSS Token Assembly & Multi-Tier Lookup**:
   - Matches each GLOSS token against the dictionary using a 4-tier cascade:
     1. *Exact match* in local dictionary.
     2. *Anchor / Synonym match* (e.g., `AEROPLANE` $\rightarrow$ `AIRPLANE`).
     3. *Partial substring match*.
     4. *ChromaDB Semantic Vector search* using cosine similarity over `all-MiniLM-L6-v2` embeddings.

---

### 2.2 Reverse Pipeline: Sign Video $\rightarrow$ English Text (Port 8001)

The reverse pipeline translates continuous ISL sign video into natural English sentences.

```
[Mobile/Web Camera]
       │
       ▼ (5-8s Video Clip: .mp4 or .webm)
[POST /api/translate-video] (Port 8001)
       │
       ▼
[Buffer to /tmp/]
       │
       ▼
[Google GenAI Client]
       │
       ▼ (Streams bytes to Gemini File API)
[Gemini 3.6 Flash] ─────────► Evaluates Handshapes, Orientation, Motion & Expressions
       │
       ▼
[Prompt Constraint] ────────► "Translate continuous ISL gestures to fluent English.
       │                       Do not explain. If unclear, return UNCLEAR SIGN SEQUENCE."
       ▼
[Return Translation] ───────► { "translation": "WHAT IS YOUR NAME?" }
```

#### Why Gemini 3.6 Flash for Video Translation?
- **Multimodal Video Understanding**: Gemini natively parses spatio-temporal video frames, eliminating the need for heavy local computer vision pipelines.
- **Continuous Gesture Context**: Processes full sign sequences holistically rather than classifying isolated frames, handling coarticulation and transition movements.
- **Lightweight Client**: Eliminates bulky native dependencies (MediaPipe, OpenCV, PyTorch) from the mobile app, keeping the APK under 60MB.

---

### 2.3 CWASA WebGL 3D Avatar Bridge Protocol

The 3D avatar is encapsulated in an isolated WebView (`AvatarWebView.tsx`) that embeds the University of East Anglia (UEA) CWASA animation engine.

#### Inter-Process Communication (postMessage)
Communication between React Native and the WebView occurs via asynchronous JSON messages:

```typescript
// 1. React Native -> WebView: Play a sign
webViewRef.current.postMessage(JSON.stringify({
  type: 'play',
  url: 'https://signvision-085587597556.s3.ap-south-1.amazonaws.com/sigml-files/school.sigml'
}));

// 2. React Native -> WebView: Stop animation
webViewRef.current.postMessage(JSON.stringify({
  type: 'stop'
}));

// 3. WebView -> React Native: Status telemetry
// Emitted when animation completes or errors occur:
window.ReactNativeWebView.postMessage(JSON.stringify({
  type: 'status',
  status: 'idle' // or 'playing', 'error'
}));
```

#### Golden Rules for AvatarWebView
- **Never remount the WebView**: Toggling or unmounting re-initializes the WebGL GPU context, causing a noticeable 1–2 second stall.
- **Keep the HTML wrapper immutable**: The CWASA HTML template contains fragile script dependencies and initialization timing hooks that should not be modified unprompted.

---

### 2.4 Storage & Asset Delivery Architecture

#### AWS S3 Asset Bucket
- **Bucket**: `signvision-085587597556`
- **Region**: `ap-south-1` (Mumbai)
- **Asset Count**: 1,500+ `.sigml` XML files under `sigml-files/`
- **Access Policy**: Public read-only (`s3:GetObject`)
- **CORS Configuration**: Wildcard `*` origin for `GET` and `HEAD` requests to ensure WebGL WebViews can load assets without cross-origin blocks.

#### Local Offline Dictionary
- **Location**: `Application/src/data/sign_language_data.json` (mirrored in `data/sign_language_data.json`)
- **Structure**: Pre-compiled JSON mapping uppercase GLOSS terms to S3 URLs, category tags, and linguistic anchor synonyms.
- **Lookup Performance**: < 5ms in-memory access with zero network dependency.

---

*SignVision — Engineered for performance, accuracy, and accessibility.*
