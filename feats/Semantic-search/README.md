# Semantic Search (Words + ChromaDB)

This project builds embeddings for words from `words.txt` and stores them in ChromaDB, then lets you run interactive semantic search from the terminal.

## Project Files

- `embedStore.py`: Loads words, generates embeddings, stores them in ChromaDB
- `searchEmbeddings.py`: Interactive search over stored embeddings
- `words.txt`: Input word list (one word or phrase per line)
- `requirement.txt`: Python dependencies

## Prerequisites

- Python 3.10 or newer
- `pip`

## Setup

1. Open a terminal in the project folder.
2. (Recommended) Create and activate a virtual environment.
3. Install dependencies.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirement.txt
```

## Run the Project

### 1) Build and Store Embeddings

Run this first. It reads `words.txt` and creates a persistent local database in `./chroma_db`.

```bash
python embedStore.py
```

### 2) Start Semantic Search

```bash
python searchEmbeddings.py
```

## Search Commands

Inside the search prompt:

- Type any word or phrase to search
- `:q` to quit
- `:k <number>` to change number of results (top-k)
- `:min <0-1>` to change minimum similarity threshold

## Typical Workflow

1. Edit `words.txt` with your own terms.
2. Run `python embedStore.py` to rebuild embeddings.
3. Run `python searchEmbeddings.py` and query terms interactively.

## Notes

- On first run, the embedding model (`all-MiniLM-L6-v2`) is downloaded, so it may take longer.
- Re-running `embedStore.py` replaces the previous `words` collection to avoid duplicates.

## Troubleshooting

- `No such collection` or collection not found:
  - Run `python embedStore.py` before starting search.
- Dependency install issues:
  - Upgrade pip: `python -m pip install --upgrade pip`
  - Re-run: `pip install -r requirement.txt`
