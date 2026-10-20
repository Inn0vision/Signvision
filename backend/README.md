# SignVision Core Backend (`backend/`)

> **FastAPI NLP translation engine converting English text and speech into Indian Sign Language (ISL) GLOSS tokens and S3 3D animation URLs.**

---

## ⚡ 1. Brief Quickstart & Endpoints (TL;DR)

### Quick Commands

```bash
# 1. Setup virtual environment & dependencies
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 2. Download spaCy transformer language model
python -m spacy download en_core_web_trf

# 3. (One-time) Build ChromaDB vector embeddings
python -c "from app.services.semantic_search import build_embeddings; build_embeddings()"

# 4. Start the FastAPI server on port 8000
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Key API Endpoints

| Method | Endpoint | Description | Sample Payload / Params |
|:---|:---|:---|:---|
| `GET` | `/health` | System health & dictionary size | None |
| `POST` | `/process` | 6-stage English-to-ISL pipeline | `{"text": "I am eating an apple"}` |
| `GET` | `/lookup/{word}` | Direct 4-tier dictionary query | `/lookup/SCHOOL` |
| `GET` | `/search` | ChromaDB vector semantic search | `/search?query=airplane&top_k=5` |
| `GET` | `/docs` | Interactive Swagger UI | Browser navigation |

---

## 🛠️ 2. Detailed Technical Manual

### 2.1 Service Architecture & Directory Structure

```
backend/
├── app/
│   ├── core/
│   │   ├── config.py            # Pydantic Settings (environment variables, paths, models)
│   │   └── nlp_engine.py         # 6-stage NLP transformation pipeline
│   ├── services/
│   │   ├── word_lookup.py       # 4-tier word resolution engine
│   │   └── semantic_search.py   # ChromaDB vector store integration
│   └── main.py                  # FastAPI app router, CORS middleware & endpoints
├── data/
│   └── chroma_db/               # Persistent ChromaDB vector database directory
└── requirements.txt             # Python dependencies
```

---

### 2.2 Configuration Management (`app/core/config.py`)

All configuration is managed through Pydantic's `BaseSettings`, loading from environment variables or `.env`:

```python
class Settings(BaseSettings):
    # Model Configurations
    SPACY_MODEL: str = "en_core_web_trf"
    GPT_API_KEY: str = ""
    GPT_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    GPT_MODEL: str = "openai/gpt-oss-120b"
    
    # Storage & Paths
    DATA_DIR: str = "../data"
    SIGN_DATA_FILE: str = "sign_language_data.json"
    CHROMA_DB_PATH: str = "./data/chroma_db"
    
    # S3 Storage
    S3_BASE_URL: str = "https://signvision-085587597556.s3.ap-south-1.amazonaws.com/sigml-files"
```

---

### 2.3 The 6-Stage NLP Pipeline (`app/core/nlp_engine.py`)

1. **Input Normalization**:
   Cleans incoming text, expands English contractions (`"don't"` $\rightarrow$ `"do not"`), strips extraneous punctuation, and normalizes capitalization.
2. **Fixed Expressions Detection**:
   Scans for conversational idioms, greetings, and common phrases (e.g. `"how are you"`, `"thank you"`). If matched, short-circuits the pipeline for sub-50ms execution.
3. **Transformer POS Tagging (`en_core_web_trf`)**:
   Runs spaCy's RoBERTa transformer pipeline to obtain high-precision part-of-speech tags and syntactic dependencies.
4. **LLM Semantic Slot Extraction (`NVIDIA GPT-120b`)**:
   Sends tokenized input to the NVIDIA API to extract structured semantic arguments:
   - `subject`, `object`, `action`, `time`, `negation`, `question_type`
5. **ISL Grammar Rule Transformation**:
   - Converts SVO (English) to SOV (ISL).
   - Positions temporal adverbs at sentence head.
   - Positions interrogative pronouns at sentence tail.
   - Removes copulas and articles (`is`, `am`, `are`, `the`, `a`).
   - Appends negation markers to the verb phrase.
6. **GLOSS Assembly & Word Lookup**:
   Assembles the final GLOSS sequence (e.g. `["TOMORROW", "I", "APPLE", "EAT"]`) and looks up corresponding S3 `.sigml` URLs.

---

### 2.4 Multi-Tier Word Lookup Cascade (`app/services/word_lookup.py`)

When matching GLOSS tokens to animation assets, the backend executes a 4-tier fallback:

```
Tier 1: Exact Match (Direct dictionary key lookup)
   │
   ▼ (if not found)
Tier 2: Anchor Match (Synonyms & alias arrays)
   │
   ▼ (if not found)
Tier 3: Partial Match (Substring containment)
   │
   ▼ (if not found)
Tier 4: ChromaDB Semantic Search (Cosine similarity on all-MiniLM-L6-v2 embeddings)
```

---

### 2.5 CORS & Network Security (`app/main.py`)

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Enforces compliance with W3C Fetch spec for wildcard origins
    allow_methods=["*"],
    allow_headers=["*"],
)
```

> **Note**: Backends must always bind to `0.0.0.0` when started (`--host 0.0.0.0`) so mobile devices on the same Wi-Fi subnet can connect.

---

### 2.6 Verification & Testing

```bash
# Test 1: Healthcheck
curl -s http://localhost:8000/health | jq .

# Test 2: Word Lookup
curl -s http://localhost:8000/lookup/SCHOOL | jq .

# Test 3: Sentence Translation
curl -s -X POST http://localhost:8000/process \
  -H "Content-Type: application/json" \
  -d '{"text": "Where are you going?"}' | jq .
```

---

*SignVision — Core Backend Documentation.*
