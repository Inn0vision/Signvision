# SignVision: Technical Documentation

## 1. Executive Summary

**SignVision** is a comprehensive speech-to-sign-language translation system that converts English speech and text into Indian Sign Language (ISL) visual representations. The system employs a hybrid NLP pipeline combining transformer-based linguistic analysis, Large Language Model (LLM) semantic extraction, and vector-based semantic search to generate GLOSS tokens, which are then rendered as 3D sign animations using the CWASA (Client-side WebGL Avatar for Sign Animation) system.

### Key Technical Highlights

| Component | Technology |
|-----------|------------|
| Backend Framework | FastAPI (Python 3.10+) |
| NLP Processing | spaCy (en_core_web_trf) + LLM (GPT via NVIDIA API) |
| Semantic Search | SentenceTransformer (all-MiniLM-L6-v2) + ChromaDB |
| Frontend Framework | React Native + Expo (Cross-platform) |
| Sign Rendering | CWASA WebGL Avatar System |
| Sign Format | SiGML (Signing Gesture Markup Language) |
| Storage | AWS S3 (SiGML files) + Local JSON (mappings) |

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                  │
│                     React Native + Expo (Mobile/Web)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────────────┐ │
│  │ SearchBar   │  │ HomeScreen  │  │ AvatarWebView (CWASA WebGL)        │ │
│  │ (Voice/Text)│  │             │  │ 3D Sign Animation Renderer          │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────────────────┘ │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ REST API
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND API (FastAPI)                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         Processing Pipeline                           │  │
│  │  ┌───────────┐   ┌───────────────┐   ┌────────────┐   ┌───────────┐ │  │
│  │  │ Audio     │──▶│ NLP Engine    │──▶│ GLOSS      │──▶│ Word      │ │  │
│  │  │ Transcribe│   │ (spaCy + LLM) │   │ Generation │   │ Lookup    │ │  │
│  │  └───────────┘   └───────────────┘   └────────────┘   └───────────┘ │  │
│  │                                                              │        │  │
│  │                                                              ▼        │  │
│  │                                              ┌────────────────────┐   │  │
│  │                                              │ Semantic Search    │   │  │
│  │                                              │ (Fallback Lookup)  │   │  │
│  │                                              └────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │ ChromaDB        │  │ JSON Mappings   │  │ AWS S3                      │ │
│  │ (Vector Store)  │  │ (Sign Data)     │  │ (SiGML Animation Files)     │ │
│  │ ~1800 words     │  │ 7000+ entries   │  │ 1000+ sign animations       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow Pipeline

```
User Input (Speech/Text)
        │
        ▼
┌───────────────────┐
│ Audio Transcription│  (Google Speech Recognition API)
│ (if audio input)  │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Text Preprocessing │
│ - Lowercasing     │
│ - Contraction     │
│   expansion       │
│ - Sentence split  │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Linguistic        │  spaCy en_core_web_trf (RoBERTa-based)
│ Analysis          │  - Tokenization
│                   │  - POS Tagging
│                   │  - Dependency Parsing
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ LLM Semantic      │  NVIDIA GPT API (gpt-oss-120b)
│ Extraction        │  - Subject/Object/Verb extraction
│                   │  - Tense detection
│                   │  - Negation/Question detection
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ ISL Rule Engine   │  Rule-based transformation
│                   │  - SOV word order
│                   │  - Time marker insertion
│                   │  - Question word placement
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ GLOSS Token       │  Example: "I GO SCHOOL FUTURE"
│ Generation        │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Word Lookup       │  Multi-stage lookup:
│ Service           │  1. Exact match
│                   │  2. Anchor/synonym match
│                   │  3. Partial match
│                   │  4. Semantic search fallback
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ S3 URL Resolution │  SiGML file URLs for each GLOSS token
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ CWASA Avatar      │  WebGL 3D rendering of sign animations
│ Rendering         │  Sequential playback of sign queue
└───────────────────┘
```

---

## 3. Backend Architecture

### 3.1 Framework & Structure

The backend is built using **FastAPI**, a modern, high-performance Python web framework.

**Directory Structure:**
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application entry point
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py        # Pydantic settings management
│   │   └── nlp_engine.py    # Core NLP processing pipeline
│   └── services/
│       ├── __init__.py
│       ├── word_lookup.py   # Sign data lookup service
│       └── semantic_search.py  # Vector search service
├── data/
│   └── sign_language_data.json  # Sign mappings
└── requirements.txt
```

### 3.2 API Endpoints

| Endpoint | Method | Description | Input | Output |
|----------|--------|-------------|-------|--------|
| `/process` | POST | Text → GLOSS → Sign URLs | `{"text": "string"}` | GLOSS tokens + S3 URLs |
| `/transcribe` | POST | Audio → Text → GLOSS → Sign URLs | Audio file (multipart) | Transcription + GLOSS + URLs |
| `/process_text` | POST | Text → GLOSS only | `{"text": "string"}` | GLOSS tokens only |
| `/lookup/{word}` | GET | Single word lookup | Word path param | S3 URL + match info |
| `/search` | GET | Semantic search | `query`, `top_k` params | Similar words + scores |
| `/health` | GET | Health check | None | Word count + status |

### 3.3 Configuration

Configuration is managed via Pydantic Settings with environment variable support:

```python
class Settings(BaseSettings):
    # LLM Configuration
    GPT_API_KEY: str = ""
    GPT_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    GPT_MODEL: str = "openai/gpt-oss-120b"

    # Embedding & Vector Store
    CHROMA_DB_PATH: str = "./data/chroma_db"
    CHROMA_COLLECTION: str = "words"
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    # Semantic Search Parameters
    SEMANTIC_SEARCH_TOP_K: int = 5
    SEMANTIC_SEARCH_MIN_SIMILARITY: float = 0.5

    # Data Paths
    DATA_DIR: Path = Path(__file__).parent.parent.parent / "data"
    SIGN_LANGUAGE_DATA_FILE: str = "sign_language_data.json"
    WORDS_FILE: str = "words.txt"
```

---

## 4. NLP Pipeline

### 4.1 Pipeline Overview

The NLP pipeline is a hybrid system combining:
1. **Rule-based preprocessing** (deterministic)
2. **Transformer-based linguistic analysis** (spaCy)
3. **LLM-based semantic extraction** (GPT)
4. **Rule-based ISL grammar transformation** (deterministic)

### 4.2 Text Preprocessing

**Contraction Expansion:**
```python
CONTRACTION_MAP = {
    "don't": "do not",
    "i'm": "i am",
    "you're": "you are",
    # ... 60+ contractions
}
```

**Processing Steps:**
1. Lowercase conversion
2. Contraction expansion (regex-based)
3. Sentence boundary detection (`.!?`)
4. Punctuation removal
5. Whitespace normalization

### 4.3 Linguistic Analysis (spaCy)

**Model:** `en_core_web_trf` (Transformer-based, RoBERTa architecture)

**Extracted Features:**
- Token sequence
- Part-of-Speech (POS) tags
- Dependency parse tree
- Named Entity Recognition

```python
nlp = spacy.load("en_core_web_trf")
doc = nlp(sentence)
tokens = [token.text for token in doc]
pos_tags = [token.pos_ for token in doc]
```

### 4.4 LLM Semantic Extraction

**Model:** NVIDIA GPT API (`openai/gpt-oss-120b`)

**Configuration:**
- Temperature: 0.1 (low randomness for consistency)
- Top-p: 0.95
- Max tokens: 1024
- Retry mechanism: 2 attempts with confidence threshold (≥95%)

**Extracted Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `subject` | string/null | Main subject performing action |
| `object` | string/null | Entity receiving action |
| `tense` | PAST/PRESENT/FUTURE | Temporal context |
| `negation` | boolean | Presence of negation |
| `sentence_type` | statement/yes_no_question/wh_question | Sentence classification |
| `normalized_verb` | string/null | Base form of main verb |
| `adjective` | string/null | Predicative adjective (state sentences) |
| `has_explicit_time_word` | boolean | Contains temporal words |
| `requires_time_marker` | boolean | Needs ISL time marker |
| `confidence` | int (0-100) | Extraction confidence score |

**Prompt Engineering:**

The LLM prompt includes:
- Detailed context about ISL requirements
- Explicit rules for edge cases (WH-words, auxiliaries, possessives)
- Multiple examples with expected outputs
- Self-validation instructions

### 4.5 ISL Rule Engine

**ISL Grammar Transformations:**

1. **Word Order:** Subject-Object-Verb (SOV)
   - English: "I go to school"
   - ISL GLOSS: "I SCHOOL GO"

2. **Time Markers:**
   ```python
   TIME_MARKER_MAP = {
       "PAST": "YESTERDAY",
       "PRESENT": "NOW",
       "FUTURE": "FUTURE",
   }
   ```

3. **Article Removal:** "a", "an", "the" are dropped

4. **Auxiliary Verb Handling:** "is", "am", "are", "was", "were" are filtered

5. **Question Word Placement:** WH-words placed at end of GLOSS sequence

6. **Negation Marker:** "NOT" appended when negation detected

**Fixed Expression Handling:**
```python
FIXED_EXPRESSION_MAP = {
    "thank you": "THANKYOU",
    "how are you": "HOWAREYOU",
    "good morning": "GOOD MORNING",
    # ...
}
```

### 4.6 GLOSS Generation Algorithm

```python
def build_gloss_output(transformed: Dict) -> Dict:
    gloss_tokens = []
    
    # 1. Time markers first
    if explicit_time_words:
        gloss_tokens.extend(explicit_time_words)
    elif time_marker:
        gloss_tokens.append(time_marker)
    
    # 2. Subject
    if subject:
        gloss_tokens.append(subject.upper())
    
    # 3. Object
    if obj:
        gloss_tokens.append(obj.upper())
    
    # 4. Verb
    if verb:
        gloss_tokens.append(verb.upper())
    
    # 5. Adjective (state sentences)
    if adjective:
        gloss_tokens.append(adjective.upper())
    
    # 6. Negation marker
    if negation:
        gloss_tokens.append("NOT")
    
    # 7. Question marker
    if question_word:
        gloss_tokens.append(question_word.upper())
    elif is_question:
        gloss_tokens.append("Q")
    
    return {"gloss": gloss_tokens, ...}
```

---

## 5. Semantic Search System

### 5.1 Architecture

The semantic search system provides intelligent fallback when exact word matches fail, using dense vector representations for similarity computation.

```
┌─────────────────┐
│ Query Word      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│ SentenceTransformer         │
│ Model: all-MiniLM-L6-v2     │
│ Output: 384-dim embedding   │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ ChromaDB Vector Store       │
│ Algorithm: HNSW             │
│ Metric: Cosine Similarity   │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ Top-K Similar Words         │
│ (filtered by threshold)     │
└─────────────────────────────┘
```

### 5.2 Embedding Model

**Model:** `all-MiniLM-L6-v2` (SentenceTransformers)

**Specifications:**
| Property | Value |
|----------|-------|
| Architecture | BERT-based (6 layers) |
| Embedding Dimension | 384 |
| Max Sequence Length | 256 tokens |
| Training | MS MARCO + NLI datasets |
| Similarity Metric | Cosine |

### 5.3 Vector Database (ChromaDB)

**Configuration:**
```python
collection = client.create_collection(
    name="words",
    metadata={"hnsw:space": "cosine"}  # Cosine similarity
)
```

**Indexing Algorithm:** HNSW (Hierarchical Navigable Small World)
- Approximate Nearest Neighbor search
- O(log N) query complexity
- Persistent storage on disk

### 5.4 Embedding Generation Pipeline

```python
def build_embeddings(words_file: Path):
    # 1. Load vocabulary
    with open(words_file, "r") as f:
        words = [line.strip() for line in f if line.strip()]
    
    # 2. Initialize model
    model = SentenceTransformer("all-MiniLM-L6-v2")
    
    # 3. Generate embeddings (batch)
    embeddings = model.encode(words, show_progress_bar=True).tolist()
    
    # 4. Store in ChromaDB
    collection.add(
        ids=[str(i) for i in range(len(words))],
        documents=words,
        embeddings=embeddings,
    )
```

### 5.5 Search Algorithm

```python
def search(query: str, top_k: int = 5, min_similarity: float = 0.5):
    # 1. Encode query
    vec = model.encode([query]).tolist()
    
    # 2. Query ChromaDB
    results = collection.query(
        query_embeddings=vec,
        n_results=top_k,
    )
    
    # 3. Convert distance to similarity
    # ChromaDB returns cosine distance, not similarity
    output = [
        (word, round(1 - dist, 4))
        for word, dist in zip(results["documents"][0], results["distances"][0])
        if (1 - dist) >= min_similarity
    ]
    
    return output
```

### 5.6 Word Lookup Integration

**Multi-Stage Lookup Strategy:**

```
Query: "automobile"
        │
        ▼
┌───────────────────┐
│ 1. Exact Match    │  ──▶ "AUTOMOBILE" in JSON? ──▶ Found: Return S3 URL
└─────────┬─────────┘                                  │
          │ Not Found                                  │
          ▼                                            │
┌───────────────────┐                                  │
│ 2. Anchor Match   │  ──▶ Check anchors array ──────▶ Found: Return S3 URL
└─────────┬─────────┘                                  │
          │ Not Found                                  │
          ▼                                            │
┌───────────────────┐                                  │
│ 3. Partial Match  │  ──▶ Substring matching ───────▶ Found: Return S3 URL
└─────────┬─────────┘                                  │
          │ Not Found                                  │
          ▼                                            │
┌───────────────────┐                                  │
│ 4. Semantic Search│  ──▶ "CAR" (0.87 similarity) ──▶ Return S3 URL
└───────────────────┘
```

---

## 6. Frontend Architecture

### 6.1 Framework & Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | React Native with Expo |
| Language | TypeScript |
| Platform Support | Android, iOS, Web |
| State Management | React Hooks (useState, useRef, useEffect) |
| Speech Recognition | expo-speech-recognition |
| WebView | react-native-webview |
| Storage | @react-native-async-storage/async-storage |

### 6.2 Component Architecture

```
Application/
├── App.tsx                    # Root component
├── src/
│   ├── screens/
│   │   └── HomeScreen.tsx     # Main screen with all UI logic
│   ├── components/
│   │   ├── SearchBar.tsx      # Voice-enabled search input
│   │   └── AvatarWebView.tsx  # CWASA sign renderer
│   ├── services/
│   │   ├── apiService.ts      # Backend API client
│   │   └── s3Service.ts       # Local word lookup
│   └── types/
│       └── index.ts           # TypeScript definitions
```

### 6.3 Speech Recognition System

**Library:** `expo-speech-recognition`

**Configuration:**
```typescript
ExpoSpeechRecognitionModule.start({
    lang: locale || 'en-US',
    interimResults: true,
    maxAlternatives: 1,
    requiresOnDeviceRecognition: false,
    addsPunctuation: true,
    iosTaskHint: 'dictation',
});
```

**Features:**
- Real-time interim results
- Multi-locale support (en-US, en-IN, en-GB)
- Automatic permission handling
- Error recovery with user feedback

### 6.4 Sign Animation Rendering (CWASA)

**CWASA (Client-side WebGL Avatar for Sign Animation):**
- University of East Anglia's sign language avatar system
- WebGL-based 3D rendering
- Supports multiple avatars (Anna, Marc, Francoise, Luna)
- Renders SiGML (Signing Gesture Markup Language) files

**Integration Architecture:**
```
┌─────────────────────┐
│ React Native App    │
│                     │
│  ┌───────────────┐  │
│  │ AvatarWebView │  │
│  │  (WebView)    │  │
│  └───────┬───────┘  │
│          │          │
└──────────┼──────────┘
           │ postMessage
           ▼
┌─────────────────────┐
│ Embedded HTML       │
│                     │
│  ┌───────────────┐  │
│  │ CWASA Library │  │
│  │ (JavaScript)  │  │
│  └───────┬───────┘  │
│          │          │
│  ┌───────▼───────┐  │
│  │ WebGL Canvas  │  │
│  │ (3D Avatar)   │  │
│  └───────────────┘  │
└─────────────────────┘
```

**Message Protocol:**
```typescript
// React Native → WebView
interface PlayMessage {
    type: 'play';
    url: string;   // SiGML file URL
    word: string;  // GLOSS token
}

// WebView → React Native
interface AvatarMessage {
    type: 'ready' | 'playing' | 'finished' | 'error';
    word?: string;
    message?: string;
}
```

### 6.5 Processing Modes

**Word Mode:**
- Direct local lookup via s3Service
- Fast response (no network latency)
- Limited to exact/partial/anchor matches

**Sentence Mode:**
- Full backend NLP pipeline
- GLOSS token generation
- Sequential sign playback queue
- Semantic search fallback

### 6.6 API Client Architecture

```typescript
const API_CONFIG = {
    baseUrl: __DEV__ 
        ? 'http://10.25.12.157:8000'
        : 'https://your-production-api.com',
    timeout: 60000,
    retries: 3,
    retryDelay: 1000,
};
```

**Features:**
- Automatic retry with exponential backoff
- Timeout handling (60s)
- Error classification (retryable vs non-retryable)
- AbortController for cancellation

---

## 7. Data Architecture

### 7.1 Sign Language Data Schema

**JSON Structure (`sign_language_data.json`):**
```json
{
    "WORD": {
        "anchors": ["SYNONYM1", "SYNONYM2"],
        "category": "category_name",
        "s3_url": "https://...s3.../word.sigml",
        "hamnosys": "optional_hamnosys_notation"
    }
}
```

**Statistics:**
- Total entries: 7,075+
- Entries with S3 URLs: ~1,000+
- Categories: Numbers, Actions, Objects, etc.

### 7.2 SiGML Format

**SiGML (Signing Gesture Markup Language):**

An XML-based format for describing sign language gestures using HamNoSys (Hamburg Notation System).

**Example (`thankyou.sigml`):**
```xml
<sigml>
  <hns_sign gloss="thank you">
    <hamnosys_nonmanual></hamnosys_nonmanual>
    <hamnosys_manual>
      <hamflathand/>
      <hamextfingeru/>
      <hampalmu/>
      <hamchin/>
      <hamseqbegin/>
      <hamtouch/>
      <hamfingerpad/>
      <hammiddlefinger/>
      <hamseqend/>
      <hamreplace/>
      <hamflathand/>
      <hamextfingerol/>
      <hamextfingeruo/>
      <hampalmu/>
      <hamchest/>
    </hamnosys_manual>
  </hns_sign>
</sigml>
```

**HamNoSys Elements:**
- `hamflathand`: Hand shape (flat)
- `hamextfingeru`: Extended finger direction (up)
- `hampalmu`: Palm orientation (up)
- `hamchin`: Location (chin)
- `hamtouch`: Contact with body
- `hamseqbegin/end`: Sequential movement markers

### 7.3 Storage Architecture

```
┌─────────────────────────────────────────┐
│              AWS S3 Bucket              │
│      signvision-085587597556            │
│      Region: ap-south-1                 │
│                                         │
│  sigml-files/                           │
│  ├── zero.sigml                         │
│  ├── one.sigml                          │
│  ├── thankyou.sigml                     │
│  └── ... (1000+ files)                  │
└─────────────────────────────────────────┘
            │
            │ HTTPS
            ▼
┌─────────────────────────────────────────┐
│          Backend Server                 │
│                                         │
│  data/                                  │
│  ├── sign_language_data.json           │
│  │   (word → S3 URL mappings)          │
│  └── chroma_db/                         │
│      (vector embeddings)                │
└─────────────────────────────────────────┘
```

---

## 8. Machine Learning Models Summary

### 8.1 Models Used

| Model | Purpose | Architecture | Size |
|-------|---------|--------------|------|
| spaCy `en_core_web_trf` | Linguistic Analysis | RoBERTa-base | ~500MB |
| NVIDIA `gpt-oss-120b` | Semantic Extraction | GPT (120B params) | Cloud API |
| `all-MiniLM-L6-v2` | Semantic Embeddings | BERT (6 layers) | ~80MB |

### 8.2 Model Comparison

| Aspect | spaCy | GPT | MiniLM |
|--------|-------|-----|--------|
| Inference Location | Local | Cloud API | Local |
| Latency | ~50ms | ~1-3s | ~10ms |
| Cost | Free | Per-token | Free |
| Accuracy | High (POS/NER) | High (Semantics) | High (Similarity) |
| Customization | Fine-tunable | Prompt-based | Fine-tunable |

### 8.3 No Custom Training

The system uses **pre-trained models only**:
- No custom model training scripts
- No model checkpoints in repository
- All models used via APIs or library downloads
- Embeddings generated at setup time (one-time)

---

## 9. Dependencies

### 9.1 Backend Dependencies

```
fastapi>=0.104.0          # Web framework
uvicorn>=0.24.0           # ASGI server
pydantic>=2.5.0           # Data validation
pydantic-settings>=2.1.0  # Settings management
python-dotenv>=1.0.0      # Environment variables
python-multipart>=0.0.6   # File uploads

spacy>=3.7.0              # NLP processing
openai>=1.3.0             # LLM API client

sentence-transformers>=2.2.0  # Embedding model
chromadb>=0.4.0           # Vector database

SpeechRecognition>=3.10.0 # Audio transcription
pydub>=0.25.0             # Audio processing
```

### 9.2 Frontend Dependencies

```json
{
    "expo": "55.0.10-canary",
    "react": "19.2.0",
    "react-native": "0.83.4",
    "react-native-web": "^0.21.2",
    "react-native-webview": "^13.16.1",
    "expo-speech-recognition": "^3.1.2",
    "@react-native-async-storage/async-storage": "^3.0.2",
    "typescript": "~5.9.2"
}
```

---

## 10. Performance Characteristics

### 10.1 Latency Breakdown

| Stage | Typical Latency |
|-------|-----------------|
| Speech Recognition | 1-3s (streaming) |
| Text Preprocessing | <10ms |
| spaCy Analysis | 50-100ms |
| LLM Extraction | 1-3s |
| ISL Rule Transform | <10ms |
| Word Lookup (exact) | <5ms |
| Semantic Search | 20-50ms |
| Sign Animation Load | 100-500ms |

**Total Pipeline:** ~3-5 seconds (sentence mode)

### 10.2 Scalability Considerations

- **Stateless API:** Horizontally scalable
- **ChromaDB:** Local file-based (single-node)
- **LLM API:** Rate-limited by NVIDIA quota
- **S3:** Highly available, globally distributed

---

## 11. Security Considerations

### 11.1 Current Implementation

- **Authentication:** None (public API)
- **CORS:** Permissive (`allow_origins=["*"]`)
- **API Keys:** Environment variables only
- **SSL:** Disabled for HuggingFace downloads (self-signed cert workaround)

### 11.2 Data Privacy

- Audio files saved to local `recordings/` directory
- No user data persisted beyond session
- No analytics or telemetry

---

## 12. Limitations & Future Work

### 12.1 Current Limitations

1. **Vocabulary Coverage:** ~1,000 signs with animations (of 7,075 entries)
2. **Single Language:** English input only
3. **No Continuous Signing:** Discrete sign playback (no blending)
4. **No Sign Recognition:** Text-to-sign only (not sign-to-text)
5. **Limited Grammar:** Basic ISL rules (complex sentences may fail)

### 12.2 Potential Enhancements

1. **Multi-language Support:** Hindi, regional languages
2. **Sign Blending:** Smooth transitions between signs
3. **Custom Vocabulary:** User-defined signs
4. **Offline Mode:** Local LLM for offline processing
5. **Sign Recognition:** Computer vision for sign-to-text

---

## 13. References

1. **CWASA Avatar System:** University of East Anglia Virtual Humans Group
   - URL: https://vhg.cmp.uea.ac.uk/tech/jas/vhg2020/

2. **HamNoSys:** Hamburg Notation System for Sign Languages
   - Standard for phonetic transcription of sign languages

3. **SiGML:** Signing Gesture Markup Language
   - XML-based format for sign animation specification

4. **all-MiniLM-L6-v2:** Sentence-Transformers Model
   - URL: https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2

5. **spaCy en_core_web_trf:** Transformer-based English NLP Model
   - URL: https://spacy.io/models/en#en_core_web_trf

6. **ChromaDB:** Open-source Vector Database
   - URL: https://www.trychroma.com/

---

*Document Version: 1.0*  
*Last Updated: April 2026*  
*Project: SignVision - Speech to Indian Sign Language Translation System*
