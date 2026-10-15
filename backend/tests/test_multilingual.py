import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.multilingual_service import multilingual_service, TranslationResult
from backend.app.services.word_lookup import word_lookup_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def init_services():
    word_lookup_service.initialize()
    multilingual_service.clear_cache()


# =========================================================================
# 1. English Input Tests
# =========================================================================

def test_english_have_you_eaten_direct():
    """Verify that 'Have you eaten?' is recognized as English and processed through NLP pipeline."""
    response = client.post("/process", json={"text": "Have you eaten?"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["detected_language"] == "en"
    assert len(data["results"]) >= 1
    result = data["results"][0]
    assert "gloss" in result
    assert "signs" in result
    assert len(result["signs"]) >= 1
    # Check that signs resolved to S3 URLs
    found_signs = [s for s in result["signs"] if s["found"] and s["s3_url"]]
    assert len(found_signs) >= 1


def test_english_declarative_sentence():
    """Verify a normal English declarative sentence like 'I am eating an apple'."""
    response = client.post("/process", json={"text": "I am eating an apple"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["detected_language"] == "en"
    result = data["results"][0]
    gloss_tokens = result["gloss"]["gloss"]
    assert "APPLE" in gloss_tokens or "EAT" in gloss_tokens


def test_english_proper_name():
    """Verify an English sentence containing a proper name 'Rahul went to school'."""
    response = client.post("/process", json={"text": "Rahul went to school"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["detected_language"] == "en"
    result = data["results"][0]
    # Name should be fingerspelled or preserved in gloss
    assert len(result["signs"]) >= 1


# =========================================================================
# 2. Hindi Input Tests (Devanagari and Romanized)
# =========================================================================

def test_hindi_devanagari_khana_khaya():
    """Verify Hindi in Devanagari script: 'क्या आपने खाना खाया?' converts to English and generates ISL."""
    response = client.post("/process", json={"text": "क्या आपने खाना खाया?"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["detected_language"] in ("hi", "hi-Latn")
    assert "eat" in data["translated_text"].lower() or "food" in data["translated_text"].lower()
    result = data["results"][0]
    gloss = result["gloss"]["gloss"]
    # Check that English glosses were produced, NOT Devanagari characters
    assert all(not multilingual_service.has_devanagari(t) for t in gloss)
    found_signs = [s for s in result["signs"] if s["found"] and s["s3_url"]]
    assert len(found_signs) >= 1


def test_hindi_romanized_kya_aapne_khana_khaya():
    """Verify Romanized Hindi: 'Kya aapne khana khaya?' translates to 'Have you eaten food?'."""
    response = client.post("/process", json={"text": "Kya aapne khana khaya?"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["detected_language"] == "hi-Latn"
    assert "eat" in data["translated_text"].lower() or "food" in data["translated_text"].lower()
    result = data["results"][0]
    found_signs = [s for s in result["signs"] if s["found"] and s["s3_url"]]
    assert len(found_signs) >= 1


def test_hindi_romanized_kya_apne_khana_khya_user_prompt():
    """Verify exact user prompt variant: 'kya apne khana khya'."""
    response = client.post("/process", json={"text": "kya apne khana khya"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["detected_language"] == "hi-Latn"
    assert "eat" in data["translated_text"].lower() or "food" in data["translated_text"].lower()
    result = data["results"][0]
    gloss = result["gloss"]["gloss"]
    assert "EAT" in gloss or "FOOD" in gloss or "EATEN" in gloss
    found_signs = [s for s in result["signs"] if s["found"] and s["s3_url"]]
    assert len(found_signs) >= 1


def test_hindi_alternative_structure():
    """Verify an additional Hindi sentence: 'main seb kha raha hoon' (I am eating an apple)."""
    mock_res = TranslationResult(
        original_text="main seb kha raha hoon",
        detected_language="hi-Latn",
        confidence=0.95,
        is_english=False,
        translated_text="I am eating an apple",
    )
    with patch.object(multilingual_service, "detect_and_translate", return_value=mock_res):
        response = client.post("/process", json={"text": "main seb kha raha hoon"})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["detected_language"] == "hi-Latn"
        assert data["translated_text"] == "I am eating an apple"
        result = data["results"][0]
        gloss = result["gloss"]["gloss"]
        assert "APPLE" in gloss or "EAT" in gloss


# =========================================================================
# 3. Marathi Input Tests (Devanagari and Romanized)
# =========================================================================

def test_marathi_devanagari_jevan_kele_ka():
    """Verify Marathi in Devanagari script: 'तुम्ही जेवण केले का?'."""
    response = client.post("/process", json={"text": "तुम्ही जेवण केले का?"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["detected_language"] in ("mr", "mr-Latn")
    assert "eat" in data["translated_text"].lower() or "food" in data["translated_text"].lower()
    result = data["results"][0]
    gloss = result["gloss"]["gloss"]
    assert all(not multilingual_service.has_devanagari(t) for t in gloss)
    found_signs = [s for s in result["signs"] if s["found"] and s["s3_url"]]
    assert len(found_signs) >= 1


def test_marathi_romanized_jeven_kela_ka_user_prompt():
    """Verify exact user prompt variant: 'jeven kela ka'."""
    response = client.post("/process", json={"text": "jeven kela ka"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["detected_language"] == "mr-Latn"
    assert "eat" in data["translated_text"].lower() or "food" in data["translated_text"].lower()
    result = data["results"][0]
    gloss = result["gloss"]["gloss"]
    assert "EAT" in gloss or "FOOD" in gloss or "EATEN" in gloss
    found_signs = [s for s in result["signs"] if s["found"] and s["s3_url"]]
    assert len(found_signs) >= 1


def test_marathi_romanized_tumhi_jevan_kela_ka():
    """Verify Romanized Marathi: 'tumhi jevan kela ka'."""
    response = client.post("/process", json={"text": "tumhi jevan kela ka"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["detected_language"] == "mr-Latn"
    assert "eat" in data["translated_text"].lower() or "food" in data["translated_text"].lower()


def test_marathi_alternative_sentence():
    """Verify an additional Marathi sentence: 'kasa ahes' (How are you?)."""
    response = client.post("/process", json={"text": "kasa ahes"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["detected_language"] == "mr-Latn"
    assert data["translated_text"] == "How are you?"
    result = data["results"][0]
    assert result["gloss"]["gloss"] == ["HOW ARE YOU"]


# =========================================================================
# 4. Error Handling Tests
# =========================================================================

def test_empty_input_handling():
    """Verify empty input returns clean error, not 500."""
    response = client.post("/process", json={"text": "   "})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert "error" in data
    assert "empty" in data["error"].lower()


def test_translation_provider_failure_handling():
    """When translation provider fails, backend returns informative error without corrupting NLP."""
    with patch.object(multilingual_service, "_translate_with_llm", side_effect=Exception("API timeout")):
        response = client.post("/process", json={"text": "कुछ नया वाक्य जो डिक्शनरी में नहीं है"})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "error" in data
        assert len(data["results"]) == 0


def test_invalid_empty_translation_output():
    """If translation returns empty text, backend fails safely."""
    with patch.object(multilingual_service, "_translate_with_llm", side_effect=ValueError("LLM produced empty translation")):
        response = client.post("/process", json={"text": "अज्ञात शब्द"})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "error" in data


# =========================================================================
# 5. End-to-End Pipeline Verification
# =========================================================================

def test_end_to_end_full_response_contract():
    """Verify FullResponse contract with original_text, detected_language, translated_text, and results."""
    response = client.post("/process", json={"text": "kya apne khana khya"})
    assert response.status_code == 200
    data = response.json()
    assert "success" in data
    assert "text" in data
    assert "original_text" in data
    assert "detected_language" in data
    assert "translated_text" in data
    assert "results" in data
    assert data["original_text"] == "kya apne khana khya"
    assert data["detected_language"] == "hi-Latn"
    assert data["translated_text"] == "Have you eaten food?"
    assert len(data["results"]) >= 1


def test_process_text_endpoint_multilingual():
    """Verify /process_text endpoint also supports multilingual input."""
    response = client.post("/process_text", json={"text": "jeven kela ka"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["detected_language"] == "mr-Latn"
    assert data["translated_text"] == "Have you eaten food?"
    assert len(data["results"]) >= 1
    assert "gloss" in data["results"][0]
