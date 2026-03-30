
from fastapi import Body
from pydantic import BaseModel
import speech_recognition as sr
from pydub import AudioSegment
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import tempfile
import base64
from datetime import datetime
import shutil
import nlp_engine

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Route to process text in NLP engine
class TextPayload(BaseModel):
    text: str

@app.post("/process_text")
async def process_text_endpoint(payload: TextPayload):
    """Process text through the hybrid NLP engine and return ISL gloss results."""
    try:
        results = nlp_engine.process_text(payload.text)
        return {
            "success": True,
            "text": payload.text,
            "results": results,
        }
    except Exception as e:
        print(f"[ERROR] NLP processing failed: {e}")
        raise HTTPException(status_code=500, detail=f"NLP processing error: {str(e)}")

class AudioUpload(BaseModel):
    filename: str
    filedata: str

# Create recordings directory if it doesn't exist
RECORDINGS_DIR = os.path.join(os.path.dirname(__file__), 'recordings')
if not os.path.exists(RECORDINGS_DIR):
    os.makedirs(RECORDINGS_DIR)
    print(f"Created recordings directory at {RECORDINGS_DIR}")

def transcribe_audio(file_path: str) -> str:
    wav_file_path = os.path.join(RECORDINGS_DIR, "temp_conversion.wav")
    
    try:
        print(f"[DEBUG] Converting audio file: {file_path}")
        audio = AudioSegment.from_file(file_path)
        audio.export(wav_file_path, format="wav")
        print(f"[DEBUG] Audio converted to WAV successfully")
    except Exception as e:
        print(f"[ERROR] Audio conversion failed: {str(e)}")
        if os.path.exists(wav_file_path):
            os.remove(wav_file_path)
        raise HTTPException(status_code=400, detail=f"Error converting audio: {str(e)}")

    recognizer = sr.Recognizer()

    try:
        print(f"[DEBUG] Starting transcription with Google Speech Recognition API...")
        with sr.AudioFile(wav_file_path) as source:
            audio_data = recognizer.record(source)
            print(f"[DEBUG] Audio loaded, sending to Google API...")

        text = recognizer.recognize_google(audio_data)
        print(f"[DEBUG] Transcription successful: {text}")
        return text

    except sr.UnknownValueError:
        print(f"[ERROR] Could not understand the audio")
        raise HTTPException(status_code=422, detail="Could not understand the audio")
    except sr.RequestError as e:
        print(f"[ERROR] Google API request failed: {str(e)}")
        raise HTTPException(status_code=503, detail=f"API request error: {e}")
    finally:
        if os.path.exists(wav_file_path):
            os.remove(wav_file_path)

@app.post("/transcribe")
async def transcribe_audio_endpoint(file: UploadFile = File(...)):
    print(f"[INFO] /transcribe endpoint hit with filename={file.filename}")
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    allowed_extensions = ['.wav', '.mp3', '.m4a', '.ogg', '.flac', '.aac']
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file format. Allowed: {', '.join(allowed_extensions)}"
        )
    
    saved_file_path_backend = None
    temp_file_path = None
    try:
        content = await file.read()
        
        # Create timestamped filename and save to backend
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name = os.path.splitext(file.filename)[0]
        saved_filename = f"{base_name}_{timestamp}{file_ext}"
        saved_file_path_backend = os.path.join(RECORDINGS_DIR, saved_filename)
        
        # Save the file to backend recordings folder
        with open(saved_file_path_backend, 'wb') as f:
            f.write(content)
        
        print(f"[INFO] Audio file saved to: {saved_file_path_backend}")
        
        # Create temporary file for transcription
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_file:
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        text = transcribe_audio(temp_file_path)
        # Process the transcribed text through the hybrid NLP engine
        try:
            nlp_results = nlp_engine.process_text(text)
        except Exception as e:
            print(f"[WARNING] NLP processing failed: {e}")
            nlp_results = []
        
        return JSONResponse(
            content={
                "success": True, 
                "text": text,
                "saved_path": saved_filename,
                "nlp_results": nlp_results,
            },
            status_code=200
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Exception in /transcribe: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/")
async def root():
    return {
        "message": "Audio Transcription API",
        "recordings_dir": RECORDINGS_DIR,
        "endpoints": [
            "/transcribe (multipart form - recommended)",
            "/transcribe-base64 (base64 - slower)",
            "/recordings",
            "/health"
        ]
    }

@app.get("/recordings")
async def list_recordings():
    """List all saved recordings in the backend"""
    try:
        recordings = []
        if os.path.exists(RECORDINGS_DIR):
            for filename in os.listdir(RECORDINGS_DIR):
                file_path = os.path.join(RECORDINGS_DIR, filename)
                if os.path.isfile(file_path):
                    file_size = os.path.getsize(file_path)
                    file_time = os.path.getmtime(file_path)
                    recordings.append({
                        "filename": filename,
                        "size_bytes": file_size,
                        "size_mb": round(file_size / (1024 * 1024), 2),
                        "timestamp": datetime.fromtimestamp(file_time).isoformat()
                    })
        
        return JSONResponse(
            content={
                "success": True,
                "count": len(recordings),
                "recordings": sorted(recordings, key=lambda x: x["timestamp"], reverse=True),
                "directory": RECORDINGS_DIR
            },
            status_code=200
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing recordings: {str(e)}")

@app.post("/transcribe-base64")
async def transcribe_base64_endpoint(audio: AudioUpload):
    allowed_extensions = ['.wav', '.mp3', '.m4a', '.ogg', '.flac', '.aac']
    file_ext = os.path.splitext(audio.filename)[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file format. Allowed: {', '.join(allowed_extensions)}"
        )
    
    saved_file_path = None
    temp_file_path = None
    try:
        print(f"[INFO] Received audio upload: {audio.filename}")
        
        # Decode base64 and save to backend recordings folder
        print(f"[DEBUG] Decoding base64 data...")
        audio_bytes = base64.b64decode(audio.filedata)
        print(f"[DEBUG] Decoded {len(audio_bytes)} bytes")
        
        # Create a timestamped filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name = os.path.splitext(audio.filename)[0]
        saved_filename = f"{base_name}_{timestamp}{file_ext}"
        saved_file_path = os.path.join(RECORDINGS_DIR, saved_filename)
        
        # Save the original file to backend
        print(f"[DEBUG] Saving audio file to: {saved_file_path}")
        with open(saved_file_path, 'wb') as f:
            f.write(audio_bytes)
        print(f"[INFO] ✓ Audio file saved successfully to: {saved_file_path}")
        
        # Verify file was saved
        if os.path.exists(saved_file_path):
            file_size = os.path.getsize(saved_file_path)
            print(f"[DEBUG] File verified: {file_size} bytes")
        else:
            print(f"[ERROR] File was not saved!")
            raise Exception("File save verification failed")
        
        # Transcribe using temporary file
        print(f"[DEBUG] Creating temporary file for transcription...")
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_file:
            temp_file.write(audio_bytes)
            temp_file_path = temp_file.name
        print(f"[DEBUG] Transcription starting...")
        
        text = transcribe_audio(temp_file_path)
        print(f"[INFO] ✓ Transcription complete")
        
        return JSONResponse(
            content={
                "success": True, 
                "text": text,
                "saved_path": saved_filename
            },
            status_code=200
        )
    
    except base64.binascii.Error:
        print(f"[ERROR] Invalid base64 data")
        raise HTTPException(status_code=400, detail="Invalid base64 data")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Internal error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)
            print(f"[DEBUG] Temporary file cleaned up")
