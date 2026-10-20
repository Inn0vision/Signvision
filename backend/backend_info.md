# SignVision — Core Backend Technical Specification (`backend_info.md`)

> **Comprehensive technical specification of the Core NLP Engine, linguistic rules, semantic extraction, and vector search services.**

---

## ⚡ 1. Brief Summary (TL;DR)

The Core Backend (`backend/`) is a high-performance FastAPI service running on port 8000. It transforms unrestricted English text into grammatically accurate Indian Sign Language (ISL) GLOSS tokens and maps them to verified 3D motion assets (`.sigml` files) stored on AWS S3.

### Core Metrics
- **Runtime**: Python 3.10+ / FastAPI / Uvicorn
- **Linguistic AI**: spaCy `en_core_web_trf` (Transformer POS & Dependency Parser)
- **Semantic Reasoner**: NVIDIA GPT-120b (`openai/gpt-oss-120b`)
- **Vector Database**: ChromaDB (Cosine similarity over 384-dimensional `all-MiniLM-L6-v2` embeddings)
- **Average Latency**: 250ms – 600ms per sentence

---

## 🛠️ 2. Detailed Technical Specification

### 2.1 The 6-Stage NLP Transformation Pipeline (`app/core/nlp_engine.py`)

The NLP Engine implements an asynchronous 6-stage transformation designed to bridge the structural divergence between English and ISL:

```
[Raw English Input]
       │
       ▼
 Stage 1: Text Normalization (Regex, contractions, whitespace)
       │
       ▼
 Stage 2: Fixed Expression Short-Circuit (< 50ms)
       │
       ▼
 Stage 3: Transformer POS Tagging (spaCy en_core_web_trf)
       │
       ▼
 Stage 4: LLM Semantic Slot Extraction (NVIDIA GPT-120b)
       │
       ▼
 Stage 5: ISL Grammar Transformation Rules (SOV, Time, Wh-, Negation)
       │
       ▼
 Stage 6: GLOSS Assembly & Multi-Tier Asset Resolution
       │
       ▼
[ProcessResponse Output]
```

#### Detailed Stage Rules

##### Stage 1: Input Preprocessing & Normalization
- Cleans input using standard Unicode normalization.
- Expands common English contractions using dictionary lookup:
  - `"won't"` $\rightarrow$ `"will not"`
  - `"can't"` $\rightarrow$ `"can not"`
  - `"I'm"` $\rightarrow$ `"I am"`
  - `"they're"` $\rightarrow$ `"they are"`
- Strips non-alphanumeric punctuation while preserving clause markers.

##### Stage 2: Fixed Expressions Detection
- Contains a dictionary of idiomatic ISL greetings and standard conversational phrases.
- If an exact or fuzzy match occurs against a registered expression (e.g., `"how are you"`, `"thank you"`, `"welcome"`), the pipeline bypasses subsequent LLM and transformer stages, returning pre-compiled GLOSS sequences immediately.

##### Stage 3: Linguistic Analysis (`en_core_web_trf`)
- Analyzes tokens using spaCy's RoBERTa transformer pipeline.
- Identifies parts of speech:
  - `VERB`, `NOUN`, `PROPN`, `ADJ`, `ADV`, `PRON`, `AUX`, `DET`
- Identifies syntactic dependencies (`nsubj`, `dobj`, `prep`, `neg`, `aux`).

##### Stage 4: Semantic Slot Extraction (NVIDIA GPT-120b)
- Prompts the LLM to extract semantic arguments into a structured JSON schema:
  ```json
  {
    "subject": "I",
    "action": "EAT",
    "object": "APPLE",
    "time": null,
    "negation": false,
    "question_type": "none"
  }
  ```
- Gracefully falls back to spaCy dependency trees if the LLM endpoint is unreachable or times out.

##### Stage 5: ISL Grammar Rule Engine
- **Syntactic Reordering**: Converts English Subject-Verb-Object (SVO) order to ISL Subject-Object-Verb (SOV) order.
  - *Example*: `"I read a book"` $\rightarrow$ `[I, BOOK, READ]`
- **Time Topicalization**: In ISL, temporal markers establish the time frame of the discourse and must appear at the beginning of the sentence.
  - *Example*: `"I will go tomorrow"` $\rightarrow$ `[TOMORROW, I, GO]`
- **Interrogative Relocation**: Question words (`WHAT`, `WHERE`, `WHO`, `WHY`, `WHEN`, `HOW`) are shifted to the end of the clause.
  - *Example*: `"What is your name?"` $\rightarrow$ `[YOUR, NAME, WHAT]`
- **Removal of Redundant Tokens**:
  - Drops English articles (`a`, `an`, `the`).
  - Drops copulas and auxiliary verbs (`is`, `am`, `are`, `was`, `were`, `been`).
- **Negation Appending**: Negative markers (`NOT`, `NEVER`) are placed at the end of the verbal sequence.

##### Stage 6: GLOSS Assembly & Asset Resolution
- Capitalizes all tokens into standardized ISL GLOSS notation.
- Resolves each token to an AWS S3 `.sigml` URL using `WordLookupService`.

---

### 2.2 Multi-Tier Asset Resolution (`app/services/word_lookup.py`)

`WordLookupService` resolves GLOSS tokens through a 4-tier fallback:

```python
class WordLookupService:
    def lookup(self, word: str) -> Optional[SignMatch]:
        # Tier 1: Exact Match in dictionary
        if word in self.data:
            return SignMatch(word=word, url=self.data[word]["url"], match_type="exact")
            
        # Tier 2: Synonym & Anchor Match
        for key, entry in self.data.items():
            if word in entry.get("anchors", []):
                return SignMatch(word=key, url=entry["url"], match_type="anchor")
                
        # Tier 3: Substring Containment Match
        for key, entry in self.data.items():
            if word in key or key in word:
                return SignMatch(word=key, url=entry["url"], match_type="partial")
                
        # Tier 4: ChromaDB Vector Semantic Search
        semantic_match = self.semantic_search.search(word, top_k=1)
        if semantic_match and semantic_match[0].score >= 0.65:
            return SignMatch(
                word=semantic_match[0].word,
                url=semantic_match[0].url,
                match_type="semantic",
                score=semantic_match[0].score
            )
            
        return None
```

---

### 2.3 Semantic Vector Store (`app/services/semantic_search.py`)

- **Model**: `sentence-transformers/all-MiniLM-L6-v2` (384-dimensional dense vectors).
- **Index**: Embedded ChromaDB with HNSW (Hierarchical Navigable Small World) index.
- **Index Generation**: `build_embeddings()` extracts all 1,500+ words and anchor synonyms from `sign_language_data.json`, computes normalized vector representations, and persists the index in `backend/data/chroma_db/`.
- **Querying**: Queries execute in under 10ms on CPU using cosine similarity.

---

### 2.4 FastAPI Endpoint Schemas (`app/main.py`)

#### Pydantic Models
```python
class ProcessRequest(BaseModel):
    text: str

class SignMatch(BaseModel):
    word: str
    url: str
    match_type: str
    score: Optional[float] = None

class GlossSequence(BaseModel):
    tokens: List[str]
    sentence: str

class ProcessResponse(BaseModel):
    gloss: GlossSequence
    signs: List[SignMatch]
    processing_time_ms: float
```

---

*SignVision — Core Backend Technical Specification.*
