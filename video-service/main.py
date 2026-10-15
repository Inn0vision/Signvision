import os
import sys
import time
import uuid
import asyncio
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Query, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
BUNDLE_DIR = ROOT_DIR / "signvision_isl_inference_bundle"
load_dotenv(dotenv_path=ROOT_DIR / ".env")

# Add inference bundle to path
if str(BUNDLE_DIR) not in sys.path:
    sys.path.insert(0, str(BUNDLE_DIR))

from inference import SignVisionInferenceEngine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("video-service")

# Configuration from environment with default 50% threshold
CONFIDENCE_THRESHOLD = float(os.getenv("SIGN_CONFIDENCE_THRESHOLD", "0.50"))
MIN_HAND_COVERAGE = float(os.getenv("MIN_HAND_COVERAGE", "0.50"))

# Dynamic human-friendly phrase mappings for the trained ISL vocabulary
SIGN_PHRASE_MAPPINGS: Dict[str, str] = {
    "GOOD_MORNING": "Good morning",
    "GOOD_NIGHT": "Good night",
    "DO_YOU_UNDERSTAND": "Do you understand",
    "HOW_ARE_YOU": "How are you",
    "ITS_BEAUTIFUL_PLACE": "It's a beautiful place",
    "LIKE_DANCE": "I like to dance",
    "WHAT_IS_YOUR_NAME": "What is your name",
    "HE_IS_FATHER": "He is my father",
    "NAMSATE": "Namaste",
    "HUSBAN": "Husband",
    "THANK_YOU": "Thank you",
    "PLEASE": "Please",
    "SORRY": "Sorry",
    "BROTHER": "Brother",
    "COLLEGE": "College",
    "MAN": "Man",
    "WOMEN": "Woman",
    "WORK": "Work",
    "SCHOOL": "School",
    "SHOP": "Shop",
    "SAD": "Sad",
    "YES": "Yes",
    "NO": "No",
}

def format_sign_label(label: str) -> str:
    """Formats a predicted class label into a human-readable English phrase."""
    if not label or label == "UNCERTAIN":
        return "UNCLEAR SIGN SEQUENCE"
    if label in SIGN_PHRASE_MAPPINGS:
        return SIGN_PHRASE_MAPPINGS[label]
    return label.replace("_", " ").title()

# Global inference engine instance
engine: Optional[SignVisionInferenceEngine] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine
    logger.info("Initializing Local ISL Inference Engine...")
    t0 = time.perf_counter()
    try:
        engine = SignVisionInferenceEngine(
            model_path=str(BUNDLE_DIR / "models" / "sign_classifier.joblib"),
            metadata_path=str(BUNDLE_DIR / "models" / "model_metadata.json"),
            task_model_path=str(BUNDLE_DIR / "models" / "hand_landmarker.task"),
            default_threshold=CONFIDENCE_THRESHOLD,
            default_min_hand_coverage=MIN_HAND_COVERAGE,
        )
        t_init = (time.perf_counter() - t0) * 1000.0
        logger.info(
            f"Local ISL Engine initialized in {t_init:.1f}ms. Loaded {len(engine.get_classes())} classes."
        )
        logger.info(
            f"Configured thresholds: Acceptance Threshold={CONFIDENCE_THRESHOLD * 100:.1f}%, Min Hand Coverage={MIN_HAND_COVERAGE * 100:.1f}%"
        )
    except Exception as e:
        logger.critical(f"Failed to initialize local ISL inference engine: {e}", exc_info=True)
        raise RuntimeError(f"Engine initialization failure: {e}")

    yield

    if engine:
        logger.info("Closing Local ISL Inference Engine...")
        engine.close()
        logger.info("Engine resources released cleanly.")

app = FastAPI(
    title="SignVision Video Microservice (Local ISL ML)",
    description="Local CPU-only Indian Sign Language (ISL) recognition microservice using MediaPipe and scikit-learn",
    version="2.0.0",
    lifespan=lifespan,
)

# Rule 6: No Wildcard CORS with Credentials
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    """Health check endpoint verifying local ML engine readiness and configuration."""
    is_ready = engine is not None
    classes = engine.get_classes() if is_ready else []
    return {
        "status": "healthy" if is_ready else "initializing",
        "service": "SignVision Video Translation API (Local ISL ML)",
        "version": "2.0.0",
        "port": 8001,
        "engine_ready": is_ready,
        "classes_count": len(classes),
        "threshold": CONFIDENCE_THRESHOLD,
        "min_hand_coverage": MIN_HAND_COVERAGE,
    }

@app.get("/api/classes")
def list_supported_classes():
    """Returns the list of 23 dynamically loaded ISL sign classes."""
    if not engine:
        raise HTTPException(status_code=503, detail="Inference engine not ready")
    return {
        "total_classes": len(engine.get_classes()),
        "classes": engine.get_classes(),
    }

@app.post("/api/translate-video")
async def translate_video(
    video: UploadFile = File(...),
    threshold: Optional[float] = Query(None, ge=0.0, le=1.0, description="Confidence threshold override"),
    min_hand_coverage: Optional[float] = Query(None, ge=0.0, le=1.0, description="Hand coverage threshold override"),
    is_mirrored: Optional[bool] = Query(None, description="Whether the uploaded video is already mirrored"),
    facing_mode: Optional[str] = Query(None, description="Camera facing mode: 'front' or 'back'/'environment'"),
    min_logit_margin: Optional[float] = Query(None, ge=0.0, description="Decision margin threshold override"),
    min_motion_std: Optional[float] = Query(None, ge=0.0, description="Wrist motion std threshold override"),
):
    """
    Receives an `.mp4` or `.webm` video from the mobile/web app, runs local MediaPipe
    landmark extraction and scikit-learn classification, and returns the recognized English text.
    """
    if not engine:
        raise HTTPException(status_code=503, detail="Inference engine not ready")

    active_threshold = threshold if threshold is not None else CONFIDENCE_THRESHOLD
    active_min_coverage = min_hand_coverage if min_hand_coverage is not None else MIN_HAND_COVERAGE

    # Validate upload extension
    valid_extensions = (".mp4", ".webm", ".quicktime", ".mov", ".avi", ".mkv")
    fname_lower = (video.filename or "").lower()
    if not any(fname_lower.endswith(ext) for ext in valid_extensions):
        logger.error(f"Validation Failure: Unsupported video extension for '{video.filename}'")
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video type: {video.content_type or 'unknown'} for file {video.filename}",
        )

    content = await video.read()
    file_size = len(content)

    if file_size == 0:
        logger.error("Validation Failure: Uploaded file is completely empty.")
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    logger.info(f"Incoming video clip: {video.filename} ({file_size} bytes)")

    # Save to unique temporary file
    ext = os.path.splitext(video.filename or ".mp4")[1] or ".mp4"
    temp_file_path = f"/tmp/{uuid.uuid4()}{ext}"

    # Determine mirror requirement:
    # Training data was recorded with cv2.flip(frame, 1) (mirrored selfie view).
    # Mobile CameraView with mirror={facing === 'front'} produces ALREADY-MIRRORED video -> needs_mirror = False.
    # Web MediaRecorder produces UNMIRRORED video stream -> needs_mirror = True.
    # Back-camera third-person video is UNMIRRORED -> needs_mirror = True.
    if is_mirrored is not None:
        needs_mirror = not is_mirrored
    elif facing_mode in ("back", "environment"):
        needs_mirror = True
    else:
        needs_mirror = fname_lower.endswith(".webm")

    logger.info(f"Orientation alignment: is_mirrored={is_mirrored}, facing_mode={facing_mode} -> mirror_horizontal={needs_mirror}")

    try:
        with open(temp_file_path, "wb") as buffer:
            buffer.write(content)

        # Offload video decoding and inference to worker thread
        result = await asyncio.to_thread(
            engine.predict_video,
            video_path=temp_file_path,
            threshold=active_threshold,
            min_hand_coverage=active_min_coverage,
            mirror_horizontal=needs_mirror,
            min_logit_margin=min_logit_margin if min_logit_margin is not None else 0.0,
            min_motion_std=min_motion_std if min_motion_std is not None else 0.0,
            max_duration_sec=3.5,
        )

        status = result.get("status", "UNCERTAIN")
        pred_sign = result.get("predicted_sign", "UNCERTAIN")
        confidence = result.get("confidence", 0.0)
        hand_coverage = result.get("hand_coverage", 0.0)

        if status == "CONFIDENT" and pred_sign != "UNCERTAIN":
            translation = format_sign_label(pred_sign)
        else:
            translation = "UNCLEAR SIGN SEQUENCE"

        logger.info(
            f"Recognition result: status={status}, sign={pred_sign}, confidence={confidence * 100:.1f}%, "
            f"rejection_reason={result.get('rejection_reason', 'ACCEPTED')}, translation='{translation}'"
        )

        return JSONResponse(
            content={
                "translation": translation,
                "status": status,
                "predicted_sign": pred_sign,
                "raw_predicted_sign": result.get("raw_predicted_sign", pred_sign),
                "confidence": confidence,
                "hand_coverage": hand_coverage,
                "rejection_reason": result.get("rejection_reason", "ACCEPTED"),
                "status_message": result.get("status_message", ""),
                "runner_up": result.get("runner_up"),
                "decision_margin": result.get("decision_margin"),
                "wrist_motion": result.get("wrist_motion"),
                "gate_checks": result.get("gate_checks"),
                "top_candidates": result.get("top_candidates", []),
                "temporal_window": result.get("temporal_window"),
                "inference_time_ms": result.get("inference_time_ms", 0),
                "total_processing_time_ms": result.get("total_processing_time_ms", 0),
            }
        )

    except HTTPException:
        raise
    except ValueError as ve:
        logger.warning(f"Video decoding error: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Inference processing error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")
    finally:
        # Aggressive cleanup of temporary video file
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except OSError:
                pass
