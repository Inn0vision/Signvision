"""
SignVision Phase 2 Focused Hybrid NLP Test Suite
Verifies:
1. English affirmative fast path -> Route A local extraction (0 Groq calls)
2. English negative preservation ('NOT')
3. Yes/no question preservation ('Q' marker)
4. Time expression preservation (time fronting)
5. Past-tense verb lemma and tense extraction
6. Direct and prepositional object preservation
7. Complex/unsupported English -> Route B Groq fallback (1 Groq call)
8. Hindi input -> Route C single combined Groq call (1 Groq call total)
9. Marathi input -> Route C single combined Groq call (1 Groq call total)
10. Romanized Hindi/Marathi detected as Indic, not mishandled as plain English
11. English request does NOT make redundant translation calls (0 Groq calls)
12. Normal Indic request uses exactly 1 Groq call total
13. Malformed Groq output handled safely
14. Groq timeout / rate-limit triggers fallback without crashing
15. SemanticFrame flows through Phase 1 word lookup correctly
16. Missing signs do not cause arbitrary semantic substitutions
17. Backward compatibility with frontend ProcessResponse contract
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.core.nlp_engine import (
    process_text,
    extract_local_frame,
    SemanticFrame,
    detect_phrases_llm,
    apply_isl_rules,
    build_gloss_output,
    nlp,
)
from backend.app.services.multilingual_service import multilingual_service, TranslationResult
from backend.app.services.word_lookup import word_lookup_service

from backend.app.services.translation_cache import translation_cache

client = TestClient(app)


class MockRedisDict:
    def __init__(self):
        self.store = {}

    def get(self, key):
        return self.store.get(key)

    def set(self, key, value, ex=None):
        self.store[key] = value

    def delete(self, key):
        self.store.pop(key, None)

    def ping(self):
        return True


@pytest.fixture(autouse=True)
def setup_services():
    word_lookup_service.initialize()
    multilingual_service.clear_cache()
    mock_redis = MockRedisDict()
    orig_client = translation_cache._client
    translation_cache._client = mock_redis
    yield
    translation_cache._client = orig_client


# -----------------------------------------------------------------------------
# Scenario 1: Straightforward English affirmative sentence -> Route A (0 Groq calls)
# -----------------------------------------------------------------------------
def test_scenario_01_english_affirmative_local_path():
    with patch("backend.app.core.nlp_engine.llm_client.chat.completions.create") as mock_groq:
        results = process_text("I am eating an apple")
        assert len(results) == 1
        res = results[0]
        assert "EAT" in res["gloss"]
        assert "APPLE" in res["gloss"]
        assert "I" in res["gloss"]
        # Fast path MUST NOT call Groq
        assert mock_groq.call_count == 0


# -----------------------------------------------------------------------------
# Scenario 2: Straightforward English negative sentence preserves negation
# -----------------------------------------------------------------------------
def test_scenario_02_english_negative_preserves_not():
    with patch("backend.app.core.nlp_engine.llm_client.chat.completions.create") as mock_groq:
        results = process_text("She did not buy the book")
        assert len(results) == 1
        res = results[0]
        assert res["negation"] is True
        assert "NOT" in res["gloss"]
        assert "BOOK" in res["gloss"]
        assert "BUY" in res["gloss"]
        assert mock_groq.call_count == 0


# -----------------------------------------------------------------------------
# Scenario 3: Yes/no question preserves question type and verb meaning
# -----------------------------------------------------------------------------
def test_scenario_03_yes_no_question_preserves_type():
    with patch("backend.app.core.nlp_engine.llm_client.chat.completions.create") as mock_groq:
        results = process_text("Are you coming?")
        assert len(results) == 1
        res = results[0]
        assert res["question"] is True
        # In ISL, yes/no question without WH word ends with 'Q'
        assert res["gloss"][-1] == "Q"
        assert "COME" in res["gloss"]
        assert "YOU" in res["gloss"]
        assert mock_groq.call_count == 0


# -----------------------------------------------------------------------------
# Scenario 4: Time expression preserves time and action at head
# -----------------------------------------------------------------------------
def test_scenario_04_time_expression_head_position():
    with patch("backend.app.core.nlp_engine.llm_client.chat.completions.create") as mock_groq:
        results = process_text("Tomorrow I will go to school")
        assert len(results) == 1
        res = results[0]
        assert res["tense"] == "FUTURE"
        # Explicit time word at head
        assert res["gloss"][0] == "TOMORROW"
        assert "GO" in res["gloss"]
        assert "SCHOOL" in res["gloss"]
        assert mock_groq.call_count == 0


# -----------------------------------------------------------------------------
# Scenario 5: Past-tense sentence extracts verb lemma and past tense
# -----------------------------------------------------------------------------
def test_scenario_05_past_tense_lemma_extraction():
    with patch("backend.app.core.nlp_engine.llm_client.chat.completions.create") as mock_groq:
        results = process_text("Rahul went to school")
        assert len(results) == 1
        res = results[0]
        assert res["tense"] == "PAST"
        assert res["verb"] == "GO"
        assert "GO" in res["gloss"]
        assert "SCHOOL" in res["gloss"]
        assert mock_groq.call_count == 0


# -----------------------------------------------------------------------------
# Scenario 6: Supported sentence with object preserves object
# -----------------------------------------------------------------------------
def test_scenario_06_object_preservation():
    with patch("backend.app.core.nlp_engine.llm_client.chat.completions.create") as mock_groq:
        results = process_text("The teacher read a book")
        assert len(results) == 1
        res = results[0]
        assert res["object"] == "BOOK"
        assert "BOOK" in res["gloss"]
        assert mock_groq.call_count == 0


# -----------------------------------------------------------------------------
# Scenario 7: Complex English uses Groq fallback (Route B, 1 call)
# -----------------------------------------------------------------------------
def test_scenario_07_complex_english_routes_to_groq_fallback():
    complex_sentence = "Although the weather was stormy, the team decided to continue"
    mock_completion = MagicMock()
    mock_completion.choices = [
        MagicMock(
            message=MagicMock(
                content='''{
                    "subject": "team",
                    "object": "continue",
                    "tense": "PAST",
                    "negation": false,
                    "sentence_type": "statement",
                    "normalized_verb": "decide",
                    "adjective": null,
                    "important_phrases": [],
                    "has_explicit_time_word": false,
                    "requires_time_marker": false,
                    "confidence": 92
                }'''
            )
        )
    ]
    mock_completion.usage = None

    with patch("backend.app.core.nlp_engine.llm_client.chat.completions.create", return_value=mock_completion) as mock_groq:
        results = process_text(complex_sentence)
        assert len(results) == 1
        assert results[0]["verb"] == "DECIDE"
        # Subordinate clause triggers Groq fallback exactly once
        assert mock_groq.call_count == 1


# -----------------------------------------------------------------------------
# Scenario 8: Hindi input produces normalized English and validated semantic frame
# -----------------------------------------------------------------------------
def test_scenario_08_hindi_input_single_groq_call():
    mock_completion = MagicMock()
    mock_completion.choices = [
        MagicMock(
            message=MagicMock(
                content='''{
                    "detected_language": "hi",
                    "confidence": 0.98,
                    "is_english": false,
                    "translated_text": "I am eating an apple",
                    "semantic_frame": {
                        "subject": "i",
                        "object": "apple",
                        "tense": "PRESENT",
                        "negation": false,
                        "sentence_type": "statement",
                        "normalized_verb": "eat",
                        "adjective": null,
                        "important_phrases": [],
                        "has_explicit_time_word": false,
                        "requires_time_marker": false,
                        "confidence": 98
                    }
                }'''
            )
        )
    ]
    mock_completion.usage = None

    with patch("backend.app.core.nlp_engine.llm_client.chat.completions.create", return_value=mock_completion) as mock_groq:
        response = client.post("/process", json={"text": "मैं सेब खा रहा हूँ"})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["detected_language"] == "hi"
        assert data["translated_text"] == "I am eating an apple"
        # Total Groq calls MUST be exactly 1 (combined translation + extraction)
        assert mock_groq.call_count == 1


# -----------------------------------------------------------------------------
# Scenario 9: Marathi input produces normalized English and validated semantic frame
# -----------------------------------------------------------------------------
def test_scenario_09_marathi_input_single_groq_call():
    mock_completion = MagicMock()
    mock_completion.choices = [
        MagicMock(
            message=MagicMock(
                content='''{
                    "detected_language": "mr",
                    "confidence": 0.98,
                    "is_english": false,
                    "translated_text": "We go to school every day",
                    "semantic_frame": {
                        "subject": "we",
                        "object": "school",
                        "tense": "PRESENT",
                        "negation": false,
                        "sentence_type": "statement",
                        "normalized_verb": "go",
                        "adjective": null,
                        "important_phrases": [],
                        "has_explicit_time_word": false,
                        "requires_time_marker": false,
                        "confidence": 95
                    }
                }'''
            )
        )
    ]
    mock_completion.usage = None

    with patch("backend.app.core.nlp_engine.llm_client.chat.completions.create", return_value=mock_completion) as mock_groq:
        response = client.post("/process", json={"text": "आम्ही दररोज शाळेत जातो"})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["detected_language"] == "mr"
        assert "school" in data["translated_text"].lower() or "go" in data["translated_text"].lower()
        # Exactly 1 combined Groq call
        assert mock_groq.call_count == 1


# -----------------------------------------------------------------------------
# Scenario 10: Romanized Hindi/Marathi recognized as Indic, not plain English
# -----------------------------------------------------------------------------
def test_scenario_10_romanized_indic_detected_as_indic():
    # 'kya apne khana khya' matches offline or Groq Indic path, never misrouted to direct English
    res = multilingual_service.detect_and_translate("kya apne khana khya")
    assert res.is_english is False
    assert res.detected_language in ("hi-Latn", "hi")
    assert "eat" in res.translated_text.lower() or "food" in res.translated_text.lower()


# -----------------------------------------------------------------------------
# Scenario 11: English request does not make redundant translation call
# -----------------------------------------------------------------------------
def test_scenario_11_english_endpoint_zero_groq_calls():
    with patch("backend.app.core.nlp_engine.llm_client.chat.completions.create") as mock_groq:
        response = client.post("/process", json={"text": "I am eating an apple"})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["detected_language"] == "en"
        # Zero Groq calls for standard English
        assert mock_groq.call_count == 0


# -----------------------------------------------------------------------------
# Scenario 12: Normal Indic request uses 1 Groq call total
# -----------------------------------------------------------------------------
def test_scenario_12_indic_request_exactly_one_groq_call():
    mock_completion = MagicMock()
    mock_completion.choices = [
        MagicMock(
            message=MagicMock(
                content='''{
                    "detected_language": "hi-Latn",
                    "confidence": 0.95,
                    "is_english": false,
                    "translated_text": "I am eating an apple",
                    "semantic_frame": {
                        "subject": "i",
                        "object": "apple",
                        "tense": "PRESENT",
                        "negation": false,
                        "sentence_type": "statement",
                        "normalized_verb": "eat",
                        "adjective": null,
                        "important_phrases": [],
                        "has_explicit_time_word": false,
                        "requires_time_marker": false,
                        "confidence": 95
                    }
                }'''
            )
        )
    ]
    mock_completion.usage = None

    with patch("backend.app.core.nlp_engine.llm_client.chat.completions.create", return_value=mock_completion) as mock_groq:
        # Novel Indic sentence not in offline dictionary
        response = client.post("/process", json={"text": "hum seb kha rahe hain"})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert mock_groq.call_count == 1


# -----------------------------------------------------------------------------
# Scenario 13: Malformed Groq output is rejected or handled safely
# -----------------------------------------------------------------------------
def test_scenario_13_malformed_groq_handled_safely():
    mock_malformed = MagicMock()
    mock_malformed.choices = [
        MagicMock(message=MagicMock(content="INVALID NOT JSON AT ALL {{{"))
    ]
    mock_malformed.usage = None

    with patch("backend.app.core.nlp_engine.llm_client.chat.completions.create", return_value=mock_malformed):
        # Local fallback should handle without crashing
        results = process_text("The students completed the assignment")
        assert len(results) >= 1
        assert "gloss" in results[0]


# -----------------------------------------------------------------------------
# Scenario 14: Groq timeout/rate-limit follows defined fallback policy
# -----------------------------------------------------------------------------
def test_scenario_14_groq_failure_fallback_policy():
    from groq import APIConnectionError

    with patch("backend.app.core.nlp_engine.llm_client.chat.completions.create", side_effect=APIConnectionError(request=MagicMock())):
        with patch("time.sleep", return_value=None):
            # For English, falls back to deterministic local extraction
            results = process_text("I eat apple")
            assert len(results) == 1
            assert "EAT" in results[0]["gloss"]
            assert "APPLE" in results[0]["gloss"]


# -----------------------------------------------------------------------------
# Scenario 15: SemanticFrame flows through Phase 1 word lookup correctly
# -----------------------------------------------------------------------------
def test_scenario_15_semantic_frame_flows_to_word_lookup():
    with patch("backend.app.core.nlp_engine.llm_client.chat.completions.create") as mock_groq:
        response = client.post("/process", json={"text": "I eat apple", "use_semantic_fallback": True})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        results = data["results"]
        assert len(results) == 1
        signs = results[0]["signs"]
        assert len(signs) == 3
        found_map = {s["word"]: s["found"] for s in signs}
        assert found_map.get("I") is True
        assert found_map.get("APPLE") is True
        assert found_map.get("EAT") is True
        assert mock_groq.call_count == 0


# -----------------------------------------------------------------------------
# Scenario 16: Missing sign does not cause arbitrary semantic substitution
# -----------------------------------------------------------------------------
def test_scenario_16_missing_sign_no_arbitrary_substitution():
    # 'carpet' or unknown word with use_semantic_fallback=False must NOT substitute unrelated sign
    res = word_lookup_service.lookup("carpet", use_semantic_fallback=False)
    assert res.found is False
    assert res.match_type == "none"
    assert res.s3_url is None


# -----------------------------------------------------------------------------
# Scenario 17: Existing API response remains compatible with frontend
# -----------------------------------------------------------------------------
def test_scenario_17_frontend_api_compatibility():
    response = client.post("/process", json={"text": "Thank you"})
    assert response.status_code == 200
    data = response.json()
    # Required frontend keys in FullResponse / ProcessResponse
    assert "success" in data
    assert "text" in data
    assert "original_text" in data
    assert "detected_language" in data
    assert "translated_text" in data
    assert "results" in data
    assert isinstance(data["results"], list)
    item = data["results"][0]
    assert "gloss" in item
    assert "signs" in item
    assert "gloss" in item["gloss"]
    assert "subject" in item["gloss"]
    assert "verb" in item["gloss"]
    assert "tense" in item["gloss"]
    assert "negation" in item["gloss"]
    assert "question" in item["gloss"]
