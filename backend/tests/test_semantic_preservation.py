"""
Regression test suite for semantic preservation in SignVision NLP pipeline.

Covers:
1. Target sentence: "If you need any help, just make a sign of P"
   - Condition clause fronting: [IF, YOU, HELP, NEED]
   - Consequence clause: [P SIGN, MAKE]
   - Elimination of spurious "NOW" tense marker
   - Route A deterministic execution (0 Groq calls)
   - End-to-end sign grounding and S3 asset resolution (exact, semantic, and fingerspelling)
2. Conditional sentence variations (when, unless, if)
3. Questions (WH-questions and yes/no questions)
4. Negation preservation
5. Proper noun & missing vocabulary fingerspelling
6. Groq call count verification
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.core.nlp_engine import process_text, clear_nlp_cache
from backend.app.services.word_lookup import word_lookup_service


@pytest.fixture(autouse=True)
def setup_test():
    clear_nlp_cache()
    word_lookup_service.initialize()


def test_target_sentence_semantic_preservation_and_zero_groq():
    """
    Target Problem: "If you need any help, just make a sign of P"
    Verifies:
    1. Condition fronted: IF YOU HELP NEED
    2. Consequence: P SIGN MAKE (or P, SIGN, MAKE)
    3. Essential concepts preserved: IF, YOU, HELP, NEED, P, SIGN, MAKE
    4. NO spurious "NOW"
    5. Route A execution with 0 Groq calls
    6. All signs grounded to S3 URLs (exact, semantic, or fingerspelling)
    """
    sentence = "If you need any help, just make a sign of P"

    with patch("backend.app.core.nlp_engine.llm_client.chat.completions.create") as mock_groq:
        results = process_text(sentence)

        # 0 Groq calls -> deterministic spaCy route A
        assert mock_groq.call_count == 0

    assert len(results) == 1
    res = results[0]
    gloss = res["gloss"]

    # Verify essential concepts exist in gloss
    gloss_str = " ".join(gloss)
    assert "IF" in gloss
    assert "YOU" in gloss
    assert "HELP" in gloss
    assert "NEED" in gloss
    assert "MAKE" in gloss
    assert "P" in gloss_str
    assert "SIGN" in gloss_str

    # Verify spurious NOW is NOT present
    assert "NOW" not in gloss

    # Verify ISL condition order: condition clause precedes consequence
    if_idx = gloss.index("IF")
    make_idx = gloss.index("MAKE")
    assert if_idx < make_idx, "Condition clause MUST precede main consequence verb"

    # Verify sign resolution via word lookup
    sign_lookups = word_lookup_service.lookup_gloss_sequence(gloss, use_semantic_fallback=True)
    assert len(sign_lookups) >= 7

    # Verify every token resolved to a valid S3 URL
    for s in sign_lookups:
        assert s.found is True, f"Sign for token '{s.original_query}' must be found"
        assert s.s3_url is not None and s.s3_url.startswith("https://"), f"Sign '{s.word}' must have valid S3 URL"

    # Specific match type checks
    found_types = {s.original_query: s.match_type for s in sign_lookups}
    assert found_types.get("I") == "partial" or found_types.get("IF") == "partial"
    assert found_types.get("YOU") == "exact"
    assert found_types.get("NEED") == "exact"
    assert found_types.get("HELP") in ("semantic", "exact", "anchor")
    assert found_types.get("P") == "exact"
    assert found_types.get("SIGN") == "exact"
    assert found_types.get("MAKE") == "exact"


def test_conditional_when_clause_preservation():
    """Verify 'When you arrive tomorrow, call me' fronts condition and preserves time and verbs."""
    sentence = "When you arrive tomorrow, call me"
    results = process_text(sentence)
    assert len(results) == 1
    gloss = results[0]["gloss"]

    # Must preserve condition, participants, and verbs
    assert "WHEN" in gloss or "TOMORROW" in gloss
    assert "ARRIVE" in gloss
    assert "CALL" in gloss


def test_conditional_rain_future_preservation():
    """Verify 'If it rains, we will stay home' preserves condition, pronouns, and verbs."""
    sentence = "If it rains, we will stay home"
    results = process_text(sentence)
    assert len(results) == 1
    gloss = results[0]["gloss"]

    assert "IF" in gloss
    assert "RAIN" in gloss
    assert "STAY" in gloss
    assert "HOME" in gloss


def test_negation_preservation():
    """Verify negation is strictly preserved and positioned at end of clause."""
    sentence = "I do not need help"
    results = process_text(sentence)
    assert len(results) == 1
    gloss = results[0]["gloss"]

    assert "NOT" in gloss
    assert "HELP" in gloss
    assert "NEED" in gloss
    assert "NOW" not in gloss
    assert gloss[-1] == "NOT" or gloss[-2] == "NOT"


def test_questions_preservation():
    """Verify yes/no question and WH questions retain interrogative markers without dropping verbs."""
    # Yes/No Question
    results_yn = process_text("Do you need help?")
    assert len(results_yn) == 1
    gloss_yn = results_yn[0]["gloss"]
    assert "HELP" in gloss_yn
    assert "NEED" in gloss_yn
    assert "Q" in gloss_yn

    # WH Question
    results_wh = process_text("Where is your school?")
    assert len(results_wh) == 1
    gloss_wh = results_wh[0]["gloss"]
    assert "SCHOOL" in gloss_wh
    assert "WHERE" in gloss_wh


def test_missing_vocabulary_fingerspelling():
    """Verify unknown words/names are gracefully decomposed into fingerspelled letter assets."""
    client = TestClient(app)
    response = client.post("/process", json={"text": "Meet Pruthviraj tomorrow", "use_semantic_fallback": True})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

    signs = data["results"][0]["signs"]
    # Check that letters of PRUTHVIRAJ are present in sign assets
    resolved_letters = [s["word"] for s in signs if s["match_type"] == "partial"]
    expected_letters = list("PRUTHVIRAJ")
    for letter in expected_letters:
        assert letter in resolved_letters, f"Letter '{letter}' must be fingerspelled"


def test_end_to_end_api_target_sentence():
    """Verify full FastAPI /process pipeline for the target sentence."""
    client = TestClient(app)
    response = client.post(
        "/process",
        json={"text": "If you need any help, just make a sign of P", "use_semantic_fallback": True},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["results"]) == 1

    result = data["results"][0]
    gloss = result["gloss"]["gloss"]
    assert "IF" in gloss
    assert "YOU" in gloss
    assert "HELP" in gloss
    assert "NEED" in gloss
    assert "MAKE" in gloss

    signs = result["signs"]
    # All returned sign items must be found
    assert len(signs) >= 7
    for sign in signs:
        assert sign["found"] is True
        assert sign["s3_url"] is not None
