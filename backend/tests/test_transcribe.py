"""
Mock-based unit tests for POST /transcribe endpoint.

These tests use unittest.mock so they do NOT require:
- A real microphone or audio recording device
- The Google Speech Recognition API / internet access
- FFmpeg installation (pydub is mocked)
- Real SpeechRecognition library (patched at module level)
"""
import io
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _make_wav_bytes() -> bytes:
    """Return minimal valid WAV header bytes for testing."""
    # 44-byte header + 4 silent bytes (PCM 16-bit, 1ch, 16kHz)
    import struct
    data = b'\x00' * 4
    header = (
        b'RIFF'
        + struct.pack('<I', 36 + len(data))
        + b'WAVE'
        + b'fmt '
        + struct.pack('<I', 16)          # chunk size
        + struct.pack('<H', 1)           # PCM format
        + struct.pack('<H', 1)           # 1 channel
        + struct.pack('<I', 16000)       # 16 kHz sample rate
        + struct.pack('<I', 32000)       # byte rate
        + struct.pack('<H', 2)           # block align
        + struct.pack('<H', 16)          # bits per sample
        + b'data'
        + struct.pack('<I', len(data))
    )
    return header + data


def _upload(client: TestClient, content: bytes, filename: str = "test.wav"):
    """Submit a multipart /transcribe request."""
    return client.post(
        "/transcribe",
        files={"file": (filename, io.BytesIO(content), "audio/wav")},
    )


# ─── Tests ────────────────────────────────────────────────────────────────────

class TestTranscribeEndpoint:

    def _make_client(self):
        from backend.app.main import app
        return TestClient(app)

    @patch("backend.app.main._SR_AVAILABLE", True)
    @patch("backend.app.main._recognize_audio", return_value="hello world")
    def test_successful_transcription(self, mock_recog):
        client = self._make_client()
        response = _upload(client, _make_wav_bytes(), "audio.wav")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["text"] == "hello world"
        assert "error" not in data or data.get("error") is None

    @patch("backend.app.main._SR_AVAILABLE", True)
    @patch("backend.app.main._recognize_audio", return_value="hello world")
    def test_transcription_strips_whitespace(self, mock_recog):
        mock_recog.return_value = "  hello world  "
        client = self._make_client()
        response = _upload(client, _make_wav_bytes(), "audio.wav")
        assert response.status_code == 200
        assert response.json()["text"] == "hello world"

    @patch("backend.app.main._SR_AVAILABLE", True)
    def test_empty_audio_returns_error(self):
        client = self._make_client()
        response = client.post(
            "/transcribe",
            files={"file": ("empty.wav", io.BytesIO(b""), "audio/wav")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "empty" in data["error"].lower()

    @patch("backend.app.main._SR_AVAILABLE", True)
    def test_unsupported_format_returns_415(self):
        client = self._make_client()
        response = client.post(
            "/transcribe",
            files={"file": ("audio.xyz", io.BytesIO(b"\x00\x01"), "audio/xyz")},
        )
        assert response.status_code == 415

    @patch("backend.app.main._SR_AVAILABLE", True)
    def test_unrecognizable_audio_returns_error(self):
        """sr.UnknownValueError should map to a friendly 'cannot understand' response."""
        FakeUnknownValueError = type("UnknownValueError", (Exception,), {})
        # Patch the module-level alias the endpoint's except clause uses
        with patch("backend.app.main._SrUnknownValueError", FakeUnknownValueError):
            with patch("backend.app.main._recognize_audio", side_effect=FakeUnknownValueError()):
                client = self._make_client()
                response = _upload(client, _make_wav_bytes(), "audio.wav")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "understand" in data["error"].lower()

    @patch("backend.app.main._SR_AVAILABLE", True)
    def test_network_error_returns_error(self):
        """sr.RequestError should map to a 'service unavailable' response."""
        FakeRequestError = type("RequestError", (Exception,), {})
        with patch("backend.app.main._SrRequestError", FakeRequestError):
            with patch("backend.app.main._recognize_audio", side_effect=FakeRequestError("network failure")):
                client = self._make_client()
                response = _upload(client, _make_wav_bytes(), "audio.wav")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "unavailable" in data["error"].lower() or "service" in data["error"].lower()

    @patch("backend.app.main._SR_AVAILABLE", False)
    def test_sr_not_installed_returns_503(self):
        client = self._make_client()
        response = _upload(client, _make_wav_bytes(), "audio.wav")
        assert response.status_code == 503

    @patch("backend.app.main._SR_AVAILABLE", True)
    @patch("backend.app.main._PYDUB_AVAILABLE", False)
    def test_non_wav_without_pydub_returns_503(self):
        client = self._make_client()
        response = client.post(
            "/transcribe",
            files={"file": ("audio.webm", io.BytesIO(b"\x00\x01\x02"), "audio/webm")},
        )
        assert response.status_code == 503

    @patch("backend.app.main._SR_AVAILABLE", True)
    @patch("backend.app.main._PYDUB_AVAILABLE", True)
    @patch("backend.app.main._recognize_audio", return_value="good morning")
    @patch("backend.app.main._convert_to_wav", return_value=_make_wav_bytes())
    def test_webm_conversion_path(self, mock_convert, mock_recog):
        client = self._make_client()
        response = client.post(
            "/transcribe",
            files={"file": ("audio.webm", io.BytesIO(b"\x00\x01\x02"), "audio/webm")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["text"] == "good morning"
        mock_convert.assert_called_once()

    @patch("backend.app.main._SR_AVAILABLE", True)
    @patch("backend.app.main._recognize_audio")
    def test_empty_transcription_text_returns_error(self, mock_recog):
        mock_recog.return_value = "   "
        client = self._make_client()
        response = _upload(client, _make_wav_bytes(), "audio.wav")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False

    def test_transcribe_endpoint_exists_and_is_not_404(self):
        """Ensure /transcribe is actually mounted (returned 405 or 422, not 404)."""
        client = self._make_client()
        response = client.get("/transcribe")
        # GET is not defined, but if the route exists FastAPI returns 405, not 404
        assert response.status_code != 404
