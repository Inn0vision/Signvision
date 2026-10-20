import os
import io
import re
import logging
import tempfile
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile, Response, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

try:
    import speech_recognition as sr
    _SR_AVAILABLE = True
    # Alias the real exception types so they are patchable in tests
    _SrUnknownValueError: type = sr.UnknownValueError
    _SrRequestError: type = sr.RequestError
except ImportError:
    sr = None  # type: ignore[assignment]
    _SR_AVAILABLE = False
    # Fallback sentinels — never raised by real code, only used as except targets
    class _SrUnknownValueError(Exception):  # type: ignore[no-redef]
        pass
    class _SrRequestError(Exception):  # type: ignore[no-redef]
        pass

try:
    from pydub import AudioSegment
    _PYDUB_AVAILABLE = True
except ImportError:
    AudioSegment = None  # type: ignore[assignment,misc]
    _PYDUB_AVAILABLE = False

from .core.config import settings
from .core.nlp_engine import (
    process_text,
    reset_request_groq_tokens,
    get_request_groq_tokens,
)
from .services.word_lookup import word_lookup_service, WordLookupResult
from .services.semantic_search import semantic_search_service, build_embeddings
from .services.translation_cache import translation_cache
from .services.multilingual_service import multilingual_service

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger("main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing SignVision backend services...")
    translation_cache.connect()
    word_lookup_service.initialize()
    semantic_search_service.initialize()
    logger.info(f"Loaded {word_lookup_service.get_word_count()} sign entries")
    yield
    logger.info("Shutting down SignVision backend services...")
    translation_cache.close()


app = FastAPI(
    title="SignVision API",
    description="API for converting speech/text to Indian Sign Language (ISL)",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)




class TextPayload(BaseModel):
    text: str
    use_semantic_fallback: bool = True
    language: Optional[str] = "en"


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


class GroqTokens(BaseModel):
    input: int = 0
    output: int = 0
    overall: int = 0


class FullResponse(BaseModel):
    success: bool
    text: str
    original_text: Optional[str] = None
    detected_language: Optional[str] = None
    translated_text: Optional[str] = None
    results: List[ProcessingResult]
    error: Optional[str] = None
    groq_tokens: Optional[GroqTokens] = None


class TranscribeResponse(BaseModel):
    success: bool
    text: Optional[str] = None
    language: Optional[str] = None
    error: Optional[str] = None


# Supported audio input formats that pydub can convert to WAV.
_SUPPORTED_FORMATS = {"wav", "webm", "ogg", "mp3", "mp4", "m4a", "flac", "aiff"}


def _normalize_speech_language(lang: Optional[str]) -> str:
    """Normalize language code for speech recognition."""
    if not lang:
        return "en-IN"
    lang_clean = lang.strip().lower()
    if lang_clean in ("hi", "hi-in", "hindi"):
        return "hi-IN"
    if lang_clean in ("mr", "mr-in", "marathi"):
        return "mr-IN"
    if lang_clean in ("en", "en-in", "en-us", "en-gb", "english"):
        return "en-IN"
    return "en-IN"


def _convert_to_wav(audio_bytes: bytes, src_format: str) -> bytes:
    """Convert audio bytes to WAV bytes using pydub. Requires FFmpeg."""
    audio = AudioSegment.from_file(io.BytesIO(audio_bytes), format=src_format)
    wav_buffer = io.BytesIO()
    audio.export(wav_buffer, format="wav")
    return wav_buffer.getvalue()


def _recognize_audio(wav_bytes: bytes, language: str = "en-IN") -> str:
    """Run Google Speech Recognition on WAV bytes. Returns transcribed text."""
    recognizer = sr.Recognizer()
    audio_file = io.BytesIO(wav_bytes)
    with sr.AudioFile(audio_file) as source:
        audio_data = recognizer.record(source)
    try:
        return recognizer.recognize_google(audio_data, language=language)
    except _SrUnknownValueError:
        if language != "en-IN":
            return recognizer.recognize_google(audio_data, language="en-IN")
        raise


def _process_and_lookup(
    text: str,
    use_semantic_fallback: bool = True,
    pre_extracted_frame: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    gloss_results = process_text(text, pre_extracted_frame=pre_extracted_frame)

    output = []
    for gloss_result in gloss_results:
        gloss_tokens = gloss_result.get("gloss", [])
        named_entities = gloss_result.get("named_entities", [])

        sign_lookups = word_lookup_service.lookup_gloss_sequence(
            gloss_tokens,
            use_semantic_fallback=use_semantic_fallback,
            named_entities=named_entities,
        )

        output.append(
            {
                "gloss": gloss_result,
                "signs": [lookup.to_dict() for lookup in sign_lookups],
            }
        )

    return output





def _log_request_groq_tokens(request_text: str = "") -> Dict[str, int]:
    """Log and return the 3 Groq token numbers (input, output, overall) used for this request."""
    tokens = get_request_groq_tokens()
    inp = int(tokens.get("input", 0))
    out = int(tokens.get("output", 0))
    tot = int(tokens.get("overall", inp + out))

    logger.info(f"Groq Tokens Used: input: {inp}, output: {out}, overall: {tot}")
    print(
        f"\n==================================================\n"
        f"Groq Tokens Used:\n"
        f"  input:   {inp}\n"
        f"  output:  {out}\n"
        f"  overall: {tot}\n"
        f"==================================================",
        flush=True,
    )
    return {"input": inp, "output": out, "overall": tot}


@app.post("/process")
async def process_endpoint(payload: TextPayload, response: Response):
    """
    Main endpoint: Text -> Multilingual Translation (if needed) -> NLP -> GLOSS -> Sign URLs

    Flow:
    1. Check translation cache (HIT skips NLP and dictionary lookup)
    2. Inflight lock deduplicates concurrent requests for identical key
    3. Detect language & translate non-English (Hindi/Marathi in Devanagari or Romanized) to English
    4. Process translated English text through NLP engine to get GLOSS tokens
    5. For each GLOSS token, lookup S3 URL
    6. Cache successful result with configured TTL
    """
    reset_request_groq_tokens()
    text_stripped = payload.text.strip()
    if not text_stripped:
        response.headers["X-Translation-Cache"] = "BYPASS"
        groq_toks = _log_request_groq_tokens(payload.text)
        return {
            "success": False,
            "text": payload.text,
            "original_text": payload.text,
            "results": [],
            "error": "Empty input text",
            "groq_tokens": groq_toks,
        }

    req_lang = payload.language or "auto"
    cache_key = translation_cache.generate_cache_key(
        text=payload.text,
        use_semantic_fallback=payload.use_semantic_fallback,
        language=req_lang,
    )

    # 1. Fast path cache lookup
    cached_data, cache_status = translation_cache.get(cache_key)
    if cached_data is not None:
        logger.info("Translation cache HIT [key=%s, len=%d]", cache_key[:24], len(payload.text))
        response.headers["X-Translation-Cache"] = "HIT"
        groq_toks = _log_request_groq_tokens(payload.text)
        result_copy = dict(cached_data)
        result_copy["groq_tokens"] = groq_toks
        return result_copy

    # 2. Inflight deduplication
    async with translation_cache.inflight.lock(cache_key):
        # Re-check under lock
        cached_data, recheck_status = translation_cache.get(cache_key)
        if cached_data is not None:
            logger.info("Translation cache HIT (deduplicated) [key=%s, len=%d]", cache_key[:24], len(payload.text))
            response.headers["X-Translation-Cache"] = "HIT"
            groq_toks = _log_request_groq_tokens(payload.text)
            result_copy = dict(cached_data)
            result_copy["groq_tokens"] = groq_toks
            return result_copy

        logger.info("Translation cache %s [key=%s, len=%d]", cache_status, cache_key[:24], len(payload.text))

        try:
            # 3. Multilingual Detection & Translation
            trans_result = multilingual_service.detect_and_translate(
                payload.text,
                source_lang=payload.language if payload.language != "auto" else None,
            )
            english_text = trans_result.translated_text
            detected_lang = trans_result.detected_language

            # 4. English NLP Engine and Sign Lookup
            pre_extracted_frame = getattr(trans_result, "semantic_frame", None)
            results = _process_and_lookup(
                english_text,
                use_semantic_fallback=payload.use_semantic_fallback,
                pre_extracted_frame=pre_extracted_frame,
            )
            groq_toks = _log_request_groq_tokens(payload.text)
            response_data = {
                "success": True,
                "text": english_text,
                "original_text": payload.text,
                "detected_language": detected_lang,
                "translated_text": english_text,
                "results": results,
                "groq_tokens": groq_toks,
            }

            if response_data["success"] and len(response_data["results"]) > 0:
                translation_cache.set(cache_key, response_data)

            response.headers["X-Translation-Cache"] = cache_status
            return response_data
        except ValueError as ve:
            groq_toks = _log_request_groq_tokens(payload.text)
            logger.warning(f"Validation or translation error: {ve}")
            return {
                "success": False,
                "text": payload.text,
                "original_text": payload.text,
                "results": [],
                "error": str(ve),
                "groq_tokens": groq_toks,
            }
        except Exception as e:
            _log_request_groq_tokens(payload.text)
            logger.error(f"Processing failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))


@app.post("/process_text")
async def process_text_endpoint(payload: TextPayload):
    """Process text through NLP engine only (returns GLOSS without sign lookup)"""
    reset_request_groq_tokens()
    text_stripped = payload.text.strip()
    if not text_stripped:
        groq_toks = _log_request_groq_tokens(payload.text)
        return {
            "success": False,
            "text": payload.text,
            "original_text": payload.text,
            "results": [],
            "error": "Empty input text",
            "groq_tokens": groq_toks,
        }

    try:
        trans_result = multilingual_service.detect_and_translate(
            payload.text,
            source_lang=payload.language if payload.language != "auto" else None,
        )
        english_text = trans_result.translated_text
        pre_extracted_frame = getattr(trans_result, "semantic_frame", None)
        results = process_text(english_text, pre_extracted_frame=pre_extracted_frame)
        groq_toks = _log_request_groq_tokens(payload.text)
        return {
            "success": True,
            "text": english_text,
            "original_text": payload.text,
            "detected_language": trans_result.detected_language,
            "translated_text": english_text,
            "results": results,
            "groq_tokens": groq_toks,
        }
    except ValueError as ve:
        groq_toks = _log_request_groq_tokens(payload.text)
        return {
            "success": False,
            "text": payload.text,
            "original_text": payload.text,
            "results": [],
            "error": str(ve),
            "groq_tokens": groq_toks,
        }
    except Exception as e:
        _log_request_groq_tokens(payload.text)
        logger.error(f"NLP processing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    lang: Optional[str] = Query(None),
) -> TranscribeResponse:
    """
    Audio -> Text transcription via Google Speech Recognition.

    Accepts multipart/form-data with field 'file' containing an audio file,
    and optional 'language' (e.g. 'en-IN', 'hi-IN', 'mr-IN', 'en', 'hi', 'mr').
    Supported formats: wav, webm, ogg, mp3, mp4, m4a, flac, aiff.

    System requirements:
      - Python: SpeechRecognition>=3.10.0, pydub>=0.25.0
      - System: FFmpeg (for non-WAV format conversion)
        Ubuntu/Debian: sudo apt-get install ffmpeg
        macOS:         brew install ffmpeg

    Returns transcribed text or a structured error.
    Does NOT consume Groq/LLM tokens. Subsequent translation via /process does.
    """
    if not _SR_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="SpeechRecognition library is not installed. Run: pip install SpeechRecognition",
        )

    speech_lang = _normalize_speech_language(language or lang)

    # Determine file extension / audio format from uploaded filename
    filename = file.filename or "audio.wav"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "wav"

    if ext not in _SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported audio format '{ext}'. Supported: {', '.join(sorted(_SUPPORTED_FORMATS))}",
        )

    audio_bytes = await file.read()

    if not audio_bytes:
        return TranscribeResponse(success=False, error="Received empty audio file.")

    try:
        # Convert to WAV if necessary
        if ext != "wav":
            if not _PYDUB_AVAILABLE:
                raise HTTPException(
                    status_code=503,
                    detail="pydub is not installed. Run: pip install pydub. "
                           "FFmpeg must also be installed for format conversion.",
                )
            try:
                wav_bytes = _convert_to_wav(audio_bytes, ext)
            except Exception as conv_err:
                logger.error(f"Audio conversion failed ({ext} -> wav): {conv_err}")
                return TranscribeResponse(
                    success=False,
                    error=f"Audio format conversion failed: {conv_err}. "
                          "Ensure FFmpeg is installed (apt-get install ffmpeg).",
                )
        else:
            wav_bytes = audio_bytes

        # Run speech recognition
        try:
            transcribed_text = _recognize_audio(wav_bytes, language=speech_lang)
        except _SrUnknownValueError:
            logger.warning("Speech recognition could not understand audio")
            return TranscribeResponse(success=False, error="Could not understand the audio. Please speak clearly.")
        except _SrRequestError as req_err:
            logger.error(f"Google Speech Recognition request failed: {req_err}")
            return TranscribeResponse(
                success=False,
                error="Speech recognition service is unavailable. Check network connectivity.",
            )

        if not transcribed_text or not transcribed_text.strip():
            return TranscribeResponse(success=False, error="Transcription returned empty text.")

        logger.info(f"Transcribed ({len(audio_bytes)} bytes, lang={speech_lang}): '{transcribed_text}'")
        return TranscribeResponse(success=True, text=transcribed_text.strip(), language=speech_lang)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")


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
    if not word_lookup_service._initialized:
        word_lookup_service.initialize()
    if not semantic_search_service._initialized:
        semantic_search_service.initialize()

    nlp_ready = False
    try:
        from .core.nlp_engine import nlp
        nlp_ready = nlp is not None
    except Exception:
        pass

    chroma_ready = False
    try:
        chroma_ready = (
            semantic_search_service._collection is not None
            and semantic_search_service._collection.count() > 0
        )
    except Exception:
        pass

    cache_ready = bool(translation_cache.enabled and translation_cache._client is not None)
    is_degraded = not nlp_ready or not chroma_ready
    status = "degraded" if is_degraded else "healthy"

    return {
        "status": status,
        "word_count": word_lookup_service.get_word_count(),
        "services": {
            "nlp_spacy": "ready" if nlp_ready else "degraded",
            "semantic_search": "ready" if chroma_ready else "degraded",
            "translation_cache": "connected" if cache_ready else "disabled_or_offline",
        },
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
