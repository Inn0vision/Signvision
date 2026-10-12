# SignVision — Feature Prototyping & Experimental Modules (`feats_info.md`)

> **Architectural documentation for the experimental feature directory and standalone vector search tooling.**

---

## ⚡ 1. Brief Module Overview (TL;DR)

The `feats/` directory houses standalone feature prototypes and experimental tooling used during the research and development phases of SignVision.

### Active Feature Modules
- **`feats/Semantic-search/`**: Standalone implementation of dense vector semantic search using `sentence-transformers/all-MiniLM-L6-v2` and ChromaDB. It served as the testbed before integrating the vector store into the Core Backend (`backend/app/services/semantic_search.py`).

---

## 🛠️ 2. Detailed Technical Specification

### 2.1 Relationship to Core Backend

```
┌────────────────────────────────────────────────────────┐
│             feats/Semantic-search/ (Prototype)         │
│  - embedStore.py: Generates local ChromaDB vectors     │
│  - searchEmbeddings.py: Interactive CLI query testbed  │
└──────────────────────────┬─────────────────────────────┘
                           │ Integrated into production
                           ▼
┌────────────────────────────────────────────────────────┐
│             backend/app/services/                      │
│  - semantic_search.py: Asynchronous service class      │
│  - word_lookup.py: Tier 4 fallback in live NLP pipeline│
└────────────────────────────────────────────────────────┘
```

The scripts in `feats/Semantic-search/` provide direct CLI utilities for:
1. Re-indexing new vocabulary without booting the entire FastAPI server.
2. Evaluating nearest-neighbor retrieval quality and similarity threshold tuning on sample inputs.
3. Benchmarking vector index query latency on CPU.

---

### 2.2 Running Experiments

```bash
cd feats/Semantic-search

# 1. Install local dependencies
pip install sentence-transformers chromadb

# 2. Build or update the ChromaDB vector database
python embedStore.py

# 3. Interactively query the semantic index
python searchEmbeddings.py
```

---

*SignVision — Feature Prototyping Documentation.*
