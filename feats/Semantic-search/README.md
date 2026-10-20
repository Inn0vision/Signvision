# SignVision — Semantic Search Prototyping (`feats/Semantic-search/`)

> **Standalone vector search prototyping toolkit utilizing `sentence-transformers` and ChromaDB.**

---

## ⚡ 1. Brief Quickstart (TL;DR)

This module provides standalone tools to build and test ChromaDB vector embeddings for the SignVision vocabulary independently of the main FastAPI server.

### Quick Commands

```bash
cd feats/Semantic-search

# 1. Install required packages
pip install sentence-transformers chromadb

# 2. Compute embeddings and persist ChromaDB index
python embedStore.py

# 3. Test queries interactively in terminal
python searchEmbeddings.py
```

---

## 🛠️ 2. Detailed Technical Guide

### 2.1 Architecture & Components

```
feats/Semantic-search/
├── embedStore.py            # Generates vectors and populates ChromaDB collection
├── searchEmbeddings.py      # CLI query tool for testing retrieval accuracy
└── chromadb_store/          # Local persistent database files
```

- **Embedding Model**: `sentence-transformers/all-MiniLM-L6-v2`
  - Dimensions: 384
  - Max Sequence Length: 256 tokens
  - Distance Metric: Cosine similarity
- **Vector Database**: ChromaDB (v0.4+)
  - Storage: In-process SQLite + DuckDB index on disk
  - Collection: `sign_language_embeddings`

---

### 2.2 Script Breakdown

#### `embedStore.py`
1. Loads `sign_language_data.json`.
2. Extracts each word and its associated anchor synonyms into descriptive text chunks.
3. Passes texts through the transformer model to generate 384-dimensional dense vectors.
4. Adds embeddings, metadata (word name, S3 URL, category), and IDs to the persistent ChromaDB collection.

#### `searchEmbeddings.py`
1. Prompts user for a search query in terminal (e.g. `"airplane"`, `"physician"`, `"automobile"`).
2. Encodes the query into a 384-dimensional vector.
3. Executes a nearest-neighbor query against ChromaDB (`n_results=5`).
4. Prints matching words, similarity scores, and S3 URLs.

---

### 2.3 Integration into Core Backend

This prototype was adapted into the production backend at:
- `backend/app/services/semantic_search.py`
- `backend/app/services/word_lookup.py` (Tier 4 fallback)

---

*SignVision — Semantic Search Prototyping Guide.*
