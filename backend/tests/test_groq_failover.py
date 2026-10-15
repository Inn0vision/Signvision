import pytest
from unittest.mock import patch, MagicMock
from groq import AuthenticationError, RateLimitError
from app.core.config import settings
from app.core.nlp_engine import groq_key_manager, call_llm, _mask_key


def test_groq_keys_loaded_from_settings():
    keys = settings.get_groq_api_keys()
    assert len(keys) >= 4, f"Expected at least 4 Groq API keys, got {len(keys)}"
    # Check that user's 3 new keys and original key are all present
    expected_prefixes = ["gsk_LdU3", "gsk_603R", "gsk_7Gyx", "gsk_ioIm"]
    for prefix in expected_prefixes:
        assert any(k.startswith(prefix) for k in keys), f"Key starting with {prefix} not found"


def test_mask_key():
    assert _mask_key("") == "***"
    assert _mask_key("gsk_1234567890abcdef") == "gsk_1234...cdef"


def test_groq_failover_on_authentication_error():
    groq_key_manager.current_index = 0
    groq_key_manager.invalid_keys.clear()

    mock_completion = MagicMock()
    mock_completion.choices = [
        MagicMock(message=MagicMock(content='{"subject": "i", "object": "apple", "tense": "PRESENT", "negation": false, "sentence_type": "statement", "normalized_verb": "eat", "adjective": null, "important_phrases": [], "has_explicit_time_word": false, "requires_time_marker": false, "confidence": 90}'))
    ]
    mock_completion.usage = None

    auth_err = AuthenticationError("Invalid API Key", response=MagicMock(status_code=401), body={})

    with patch("app.core.nlp_engine.llm_client.chat.completions.create", side_effect=[auth_err, mock_completion]) as mock_create:
        with patch("time.sleep", return_value=None):
            result = call_llm("test prompt")
            assert result["subject"] == "i"
            assert mock_create.call_count == 2
            # Verify key was marked invalid and rotated
            assert len(groq_key_manager.invalid_keys) >= 1


def test_groq_failover_on_rate_limit_error():
    groq_key_manager.current_index = 0
    groq_key_manager.invalid_keys.clear()

    mock_completion = MagicMock()
    mock_completion.choices = [
        MagicMock(message=MagicMock(content='{"subject": "you", "object": null, "tense": "PRESENT", "negation": false, "sentence_type": "statement", "normalized_verb": "go", "adjective": null, "important_phrases": [], "has_explicit_time_word": false, "requires_time_marker": false, "confidence": 90}'))
    ]
    mock_completion.usage = None

    rate_err = RateLimitError("Rate limit reached: tokens per minute (TPM)", response=MagicMock(status_code=429), body={})

    with patch("app.core.nlp_engine.llm_client.chat.completions.create", side_effect=[rate_err, mock_completion]) as mock_create:
        with patch("time.sleep", return_value=None):
            result = call_llm("test prompt")
            assert result["subject"] == "you"
            assert mock_create.call_count == 2


def test_all_keys_exhausted_raises_error():
    groq_key_manager.current_index = 0
    groq_key_manager.invalid_keys.clear()

    auth_err = AuthenticationError("Invalid API Key", response=MagicMock(status_code=401), body={})

    with patch("app.core.nlp_engine.llm_client.chat.completions.create", side_effect=auth_err):
        with patch("time.sleep", return_value=None):
            with pytest.raises(ValueError, match="LLM call failed after"):
                call_llm("test prompt")
