import time
import json
from unittest.mock import patch
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.translation_cache import translation_cache
from backend.app.services.word_lookup import word_lookup_service
from backend.app.services.semantic_search import semantic_search_service
from backend.app.services.multilingual_service import multilingual_service


class MockRedisStore:
    def __init__(self):
        self.data = {}

    def get(self, key):
        return self.data.get(key)

    def set(self, key, val, ex=None):
        self.data[key] = val

    def ping(self):
        return True


def run_e2e_verification():
    print("=" * 70)
    print("SIGNVISION PHASE 3 — END-TO-END VERIFICATION & LATENCY MEASUREMENT")
    print("=" * 70)

    # Attach in-memory cache for predictable testing
    mock_redis = MockRedisStore()
    translation_cache._client = mock_redis
    translation_cache.enabled = True
    multilingual_service.clear_cache()

    client = TestClient(app)

    # 1. Health Endpoint Smoke Check
    t0 = time.perf_counter()
    resp_health = client.get("/health")
    t_health = (time.perf_counter() - t0) * 1000.0
    print(f"\n[1] GET /health (Latency: {t_health:.2f}ms)")
    print(f"    Status: {resp_health.status_code}")
    print(f"    Payload: {json.dumps(resp_health.json(), indent=2)}")
    assert resp_health.status_code == 200
    assert resp_health.json()["status"] == "healthy"

    # 2. Straightforward English (Local spaCy Fast Path, 0 Groq calls)
    test_cases_local = [
        ("I am eating an apple.", ["APPLE", "EAT"]),
        ("Where is the hospital?", ["HOSPITAL", "WHERE"]),
        ("She did not buy the book.", ["BOOK", "NOT", "BUY"]),
        ("I went to school yesterday.", ["YESTERDAY", "SCHOOL", "GO"]),
    ]

    print("\n[2] Straightforward English Sentences (Local Fast Path):")
    with patch("backend.app.core.nlp_engine.call_llm") as mock_groq:
        for sentence, expected_tokens in test_cases_local:
            t0 = time.perf_counter()
            resp = client.post("/process", json={"text": sentence, "language": "en"})
            lat = (time.perf_counter() - t0) * 1000.0
            data = resp.json()
            assert resp.status_code == 200
            assert data["success"] is True
            gloss = data["results"][0]["gloss"]["gloss"]
            signs = [s["word"] for s in data["results"][0]["signs"]]
            print(f"    Input: '{sentence}'")
            print(f"    Latency: {lat:.2f}ms | Gloss: {gloss} | Signs: {signs}")
            for token in expected_tokens:
                assert token in gloss, f"Expected token {token} missing from gloss {gloss}"
        # Confirm zero Groq calls were made
        assert mock_groq.call_count == 0, f"Expected 0 Groq calls for local path, got {mock_groq.call_count}"
        print("    -> Confirmed 0 Groq calls for straightforward English requests.")

    # 3. Cache Hit Latency Reduction Check
    print("\n[3] Cache Hit Latency Check:")
    t0 = time.perf_counter()
    resp_cached = client.post("/process", json={"text": "I am eating an apple.", "language": "en"})
    lat_cached = (time.perf_counter() - t0) * 1000.0
    assert resp_cached.status_code == 200
    assert resp_cached.headers.get("X-Translation-Cache") == "HIT"
    print(f"    Cache HIT Latency: {lat_cached:.2f}ms (Header: X-Translation-Cache=HIT)")

    # 4. Complex English (Subordination -> Controlled Groq Fallback)
    print("\n[4] Complex English (Subordination -> Route B Groq Fallback):")
    complex_text = "Although it was raining heavily outside, we walked to school."
    mock_complex_response = {
        "subject": "we",
        "object": "school",
        "tense": "PAST",
        "negation": False,
        "sentence_type": "statement",
        "normalized_verb": "walk",
        "has_explicit_time_word": False,
        "requires_time_marker": True,
        "important_phrases": [
            {"phrase": "rain heavily", "type": "concession"}
        ]
    }
    with patch("backend.app.core.nlp_engine.call_llm", return_value=mock_complex_response) as mock_groq_complex:
        t0 = time.perf_counter()
        resp_complex = client.post("/process", json={"text": complex_text, "language": "en"})
        lat_complex = (time.perf_counter() - t0) * 1000.0
        data_complex = resp_complex.json()
        assert resp_complex.status_code == 200
        gloss_complex = data_complex["results"][0]["gloss"]["gloss"]
        print(f"    Input: '{complex_text}'")
        print(f"    Latency: {lat_complex:.2f}ms | Gloss: {gloss_complex}")
        assert "PAST" in gloss_complex or "WALK" in gloss_complex or "SCHOOL" in gloss_complex
        assert mock_groq_complex.call_count == 1, f"Expected exactly 1 Groq call for complex fallback, got {mock_groq_complex.call_count}"
        print(f"    -> Confirmed exactly {mock_groq_complex.call_count} Groq call for complex fallback.")

    # 5. Indic Inputs (Hindi, Marathi, Romanized Indic -> Combined Translation + Semantic Extraction)
    print("\n[5] Indic Inputs (Combined Translation + Semantic Extraction):")
    indic_cases = [
        ("मैं सेब खा रहा हूँ।", "hi", "I am eating an apple", {
            "subject": "I", "object": "apple", "tense": "PRESENT", "normalized_verb": "eat", "negation": False
        }),
        ("मी उद्या शाळेत जाणार आहे.", "mr", "I will go to school tomorrow", {
            "subject": "I", "object": "school", "tense": "FUTURE", "normalized_verb": "go", "has_explicit_time_word": True
        }),
        ("hum seb kha rahe hain", "hi-Latn", "We are eating apples", {
            "subject": "we", "object": "apple", "tense": "PRESENT", "normalized_verb": "eat", "negation": False
        }),
    ]

    for indic_text, lang, trans_text, frame_dict in indic_cases:
        mock_indic_resp = {
            "detected_language": lang,
            "translated_text": trans_text,
            "semantic_frame": frame_dict
        }
        with patch("backend.app.core.nlp_engine.call_llm", return_value=mock_indic_resp) as mock_groq_indic:
            t0 = time.perf_counter()
            resp_indic = client.post("/process", json={"text": indic_text, "language": "auto"})
            lat_indic = (time.perf_counter() - t0) * 1000.0
            data_indic = resp_indic.json()
            assert resp_indic.status_code == 200
            gloss_indic = data_indic["results"][0]["gloss"]["gloss"]
            print(f"    Input ({lang}): '{indic_text}'")
            print(f"    Translation: '{data_indic.get('translated_text')}'")
            print(f"    Latency: {lat_indic:.2f}ms | Gloss: {gloss_indic}")
            assert mock_groq_indic.call_count == 1, f"Expected 1 combined Groq call, got {mock_groq_indic.call_count}"
            print("    -> Confirmed exactly 1 combined Groq call (no separate translation + extraction).")

    # 6. Lexicon Grounding: Exact, Alias, Semantic Search, and Fingerspelling
    print("\n[6] Sign Lexicon Grounding & ChromaDB Retrieval:")
    # Exact
    res_exact = word_lookup_service.lookup("NICE")
    print(f"    Exact match ('NICE'): found={res_exact.found}, match_type={res_exact.match_type}, s3_url={res_exact.s3_url}")
    assert res_exact.found is True
    assert res_exact.match_type == "exact"

    # Alias / Anchor
    res_alias = word_lookup_service.lookup("PLEASANT")
    print(f"    Alias match ('PLEASANT'): found={res_alias.found}, canonical={res_alias.word}, match_type={res_alias.match_type}")
    assert res_alias.found is True

    # Approved Anchor (AUTOMOBILE -> CAR)
    res_auto = word_lookup_service.lookup("AUTOMOBILE")
    print(f"    Approved anchor ('AUTOMOBILE'): found={res_auto.found}, canonical={res_auto.word}, match_type={res_auto.match_type}")
    assert res_auto.found is True
    assert res_auto.word == "CAR"
    assert res_auto.match_type == "anchor"

    # ChromaDB Semantic Retrieval (HOSPITAL -> CLINIC)
    res_semantic = word_lookup_service.lookup("HOSPITAL", use_semantic_fallback=True)
    print(f"    ChromaDB semantic retrieval ('HOSPITAL'): found={res_semantic.found}, word={res_semantic.word}, match_type={res_semantic.match_type}")
    assert res_semantic.found is True
    assert res_semantic.word == "CLINIC"
    assert res_semantic.match_type == "semantic"

    # Substring False-Positive Prevention (CARPET != CAR)
    res_carpet = word_lookup_service.lookup("CARPET", use_semantic_fallback=False)
    print(f"    Substring Safety ('CARPET'): found={res_carpet.found}, match_type={res_carpet.match_type}")
    assert res_carpet.word != "CAR", "Unsafe substring matched CARPET to CAR!"

    # Unresolved word -> Fingerspelling sequence
    seq_fingerspell = word_lookup_service.lookup_gloss_sequence(["PRUTHVIRAJ"])
    letter_words = [r.word for r in seq_fingerspell]
    print(f"    Fingerspelling fallback ('PRUTHVIRAJ'): {letter_words}")
    assert len(seq_fingerspell) == len("PRUTHVIRAJ")
    assert all(r.match_type == "partial" and r.found and r.s3_url for r in seq_fingerspell)

    print("\n" + "=" * 70)
    print("ALL INTEGRATION VERIFICATION CHECKS PASSED SUCCESSFULLY!")
    print("=" * 70)


if __name__ == "__main__":
    run_e2e_verification()
