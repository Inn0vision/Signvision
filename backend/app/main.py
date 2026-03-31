import os
import tempfile
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import speech_recognition as sr
from pydub import AudioSegment

from .core.config import settings
from .core.nlp_engine import process_text
from .services.word_lookup import word_lookup_service, WordLookupResult
from .services.semantic_search import semantic_search_service, build_embeddings

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger("main")

app = FastAPI(
    title="SignVision API",
    description="API for converting speech/text to Indian Sign Language (ISL)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RECORDINGS_DIR = settings.RECORDINGS_DIR
os.makedirs(RECORDINGS_DIR, exist_ok=True)


class TextPayload(BaseModel):
    text: str
    use_semantic_fallback: bool = True


class GlossResult(BaseModel):
    subject: Optional[str]
    object: Optional[str]
    verb: Optional[str]
    tense: str
    negation: bool
    question: bool
    gloss: List[str]


class SignLookup(BaseModel):
    word: str
    original_query: str
    found: bool
    s3_url: Optional[str]
    match_type: str
    similar_words: List[str]


class ProcessingResult(BaseModel):
    gloss: GlossResult
    signs: List[SignLookup]


class FullResponse(BaseModel):
    success: bool
    text: str
    results: List[ProcessingResult]


def _process_and_lookup(
    text: str, use_semantic_fallback: bool = True
) -> List[Dict[str, Any]]:
    gloss_results = process_text(text)

    output = []
    for gloss_result in gloss_results:
        gloss_tokens = gloss_result.get("gloss", [])

        sign_lookups = word_lookup_service.lookup_gloss_sequence(
            gloss_tokens, use_semantic_fallback=use_semantic_fallback
        )

        output.append(
            {
                "gloss": gloss_result,
                "signs": [lookup.to_dict() for lookup in sign_lookups],
            }
        )

    return output


@app.on_event("startup")
async def startup_event():
    logger.info("Initializing services...")
    word_lookup_service.initialize()
    semantic_search_service.initialize()
    logger.info(f"Loaded {word_lookup_service.get_word_count()} sign entries")


@app.post("/process")
async def process_endpoint(payload: TextPayload):
    """
    Main endpoint: Text -> NLP -> GLOSS -> Sign URLs

    Flow:
    1. Process text through NLP engine to get GLOSS tokens
    2. For each GLOSS token, lookup S3 URL
    3. If not found, use semantic search fallback
    """
    try:
        results = _process_and_lookup(
            payload.text, use_semantic_fallback=payload.use_semantic_fallback
        )

        return {
            "success": True,
            "text": payload.text,
            "results": results,
        }
    except Exception as e:
        logger.error(f"Processing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/process_text")
async def process_text_endpoint(payload: TextPayload):
    """Process text through NLP engine only (returns GLOSS without sign lookup)"""
    try:
        results = process_text(payload.text)
        return {
            "success": True,
            "text": payload.text,
            "results": results,
        }
    except Exception as e:
        logger.error(f"NLP processing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def transcribe_audio(file_path: str) -> str:
    wav_file_path = os.path.join(RECORDINGS_DIR, "temp_conversion.wav")

    try:
        audio = AudioSegment.from_file(file_path)
        audio.export(wav_file_path, format="wav")
    except Exception as e:
        if os.path.exists(wav_file_path):
            os.remove(wav_file_path)
        raise HTTPException(status_code=400, detail=f"Audio conversion error: {str(e)}")

    recognizer = sr.Recognizer()

    try:
        with sr.AudioFile(wav_file_path) as source:
            audio_data = recognizer.record(source)

        text = recognizer.recognize_google(audio_data)
        return text

    except sr.UnknownValueError:
        raise HTTPException(status_code=422, detail="Could not understand the audio")
    except sr.RequestError as e:
        raise HTTPException(
            status_code=503, detail=f"Speech recognition API error: {e}"
        )
    finally:
        if os.path.exists(wav_file_path):
            os.remove(wav_file_path)


@app.post("/transcribe")
async def transcribe_endpoint(
    file: UploadFile = File(...), use_semantic_fallback: bool = True
):
    """
    Main audio endpoint: Audio -> Text -> NLP -> GLOSS -> Sign URLs

    Flow:
    1. Transcribe audio to text
    2. Process text through NLP engine
    3. Lookup sign URLs for each GLOSS token
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    allowed_extensions = [".wav", ".mp3", ".m4a", ".ogg", ".flac", ".aac"]
    file_ext = os.path.splitext(file.filename)[1].lower()

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format. Allowed: {', '.join(allowed_extensions)}",
        )

    temp_file_path = None
    try:
        content = await file.read()

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name = os.path.splitext(file.filename)[0]
        saved_filename = f"{base_name}_{timestamp}{file_ext}"
        saved_file_path = os.path.join(RECORDINGS_DIR, saved_filename)

        with open(saved_file_path, "wb") as f:
            f.write(content)

        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_file:
            temp_file.write(content)
            temp_file_path = temp_file.name

        text = transcribe_audio(temp_file_path)

        results = _process_and_lookup(text, use_semantic_fallback=use_semantic_fallback)

        return {
            "success": True,
            "text": text,
            "saved_path": saved_filename,
            "results": results,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)


@app.get("/lookup/{word}")
async def lookup_word_endpoint(word: str, use_semantic_fallback: bool = True):
    """Lookup a single word and get its sign URL"""
    result = word_lookup_service.lookup(
        word, use_semantic_fallback=use_semantic_fallback
    )
    return result.to_dict()


@app.get("/search")
async def semantic_search_endpoint(query: str, top_k: int = 5):
    """Search for semantically similar words"""
    results = semantic_search_service.search(query, top_k=top_k)
    return {
        "query": query,
        "results": [{"word": word, "similarity": score} for word, score in results],
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "word_count": word_lookup_service.get_word_count(),
    }


@app.get("/")
async def root():
    return {
        "name": "SignVision API",
        "version": "1.0.0",
        "endpoints": [
            {
                "path": "/process",
                "method": "POST",
                "description": "Text -> GLOSS -> Sign URLs",
            },
            {
                "path": "/transcribe",
                "method": "POST",
                "description": "Audio -> Text -> GLOSS -> Sign URLs",
            },
            {
                "path": "/process_text",
                "method": "POST",
                "description": "Text -> GLOSS only",
            },
            {
                "path": "/lookup/{word}",
                "method": "GET",
                "description": "Single word lookup",
            },
            {"path": "/search", "method": "GET", "description": "Semantic search"},
            {"path": "/health", "method": "GET", "description": "Health check"},
        ],
    }
