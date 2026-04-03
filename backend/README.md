# SignVision Backend

Backend API for converting speech/text to Indian Sign Language (ISL).

## Flow

```
User speaks → Audio transcription → NLP Engine → GLOSS tokens → S3 lookup (with semantic fallback) → Sign URLs
```

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_trf
```

Copy `.env.example` to `.env` and add your NVIDIA API key:
```bash
cp .env.example .env
```

Build semantic search embeddings (one-time):
```bash
python -c "from app.services.semantic_search import build_embeddings; build_embeddings()"
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/process` | POST | Text → GLOSS → Sign URLs |
| `/transcribe` | POST | Audio → Text → GLOSS → Sign URLs |
| `/lookup/{word}` | GET | Single word lookup |
| `/search` | GET | Semantic search |
| `/health` | GET | Health check |

## Example

```bash
curl -X POST http://localhost:8000/process \
  -H "Content-Type: application/json" \
  -d '{"text": "I am going to school"}'
```
