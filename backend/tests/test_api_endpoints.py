import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data.get("status") in ("healthy", "degraded")
    assert "word_count" in data


def test_lookup_endpoint():
    response = client.get("/lookup/HELLO")
    assert response.status_code == 200
    data = response.json()
    assert data["found"] is True
    assert "s3_url" in data
    assert data["s3_url"] is not None


def test_lookup_endpoint_case_insensitive():
    response = client.get("/lookup/hello")
    assert response.status_code == 200
    data = response.json()
    assert data["found"] is True
    assert data["s3_url"] is not None


def test_search_endpoint():
    response = client.get("/search?query=hello&top_k=3")
    assert response.status_code == 200
    data = response.json()
    assert "results" in data


def test_transcribe_endpoint_exists():
    # /transcribe is restored. Posting without a file returns 422 (missing required field).
    # 404 would mean the route is not mounted at all.
    response = client.post("/transcribe")
    assert response.status_code != 404


def test_process_text_fixed_expression():
    response = client.post("/process_text", json={"text": "Thank you"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["results"]) >= 1
    assert data["results"][0]["gloss"] == ["THANK YOU"]


def test_process_fixed_expression_full_pipeline():
    response = client.post("/process", json={"text": "Thank you", "use_semantic_fallback": True})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["text"] == "Thank you"
    assert len(data["results"]) >= 1
    res = data["results"][0]
    assert "gloss" in res
    assert "signs" in res
    assert res["gloss"]["gloss"] == ["THANK YOU"]
    assert len(res["signs"]) == 1
    assert res["signs"][0]["word"] == "THANK YOU"
    assert res["signs"][0]["found"] is True
    assert res["signs"][0]["s3_url"] is not None


def test_process_with_mocked_llm():
    from unittest.mock import patch
    mock_llm_data = {
        "subject": "i",
        "object": "apple",
        "tense": "PRESENT",
        "negation": False,
        "sentence_type": "statement",
        "normalized_verb": "eat",
        "adjective": None,
        "important_phrases": [],
        "has_explicit_time_word": False,
        "requires_time_marker": False,
        "confidence": 95,
    }
    with patch("backend.app.core.nlp_engine.detect_phrases_llm", return_value=mock_llm_data):
        response = client.post("/process", json={"text": "I eat apple", "use_semantic_fallback": True})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["results"]) == 1
        gloss_res = data["results"][0]["gloss"]
        # In ISL: Subject Object Verb -> ["I", "APPLE", "EAT"]
        assert gloss_res["gloss"] == ["I", "APPLE", "EAT"]
        signs = data["results"][0]["signs"]
        assert len(signs) == 3
        words = [s["word"] for s in signs]
        assert "I" in words
        assert "APPLE" in words
        assert "EAT" in words


def test_lookup_endpoint_anchor_and_missing():
    # Anchor lookup
    res_anchor = client.get("/lookup/PC")
    assert res_anchor.status_code == 200
    data_anchor = res_anchor.json()
    assert data_anchor["found"] is True
    assert data_anchor["word"] == "COMPUTER"
    assert data_anchor["match_type"] == "anchor"

    # Not found word
    res_none = client.get("/lookup/ZZQWXY789?use_semantic_fallback=false")
    assert res_none.status_code == 200
    data_none = res_none.json()
    assert data_none["found"] is False
    assert data_none["s3_url"] is None
    assert data_none["match_type"] == "none"

