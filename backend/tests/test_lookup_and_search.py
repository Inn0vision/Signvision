import pytest
from backend.app.services.word_lookup import word_lookup_service
from backend.app.services.semantic_search import semantic_search_service, dice_similarity


def test_dice_similarity():
    assert dice_similarity("apple", "apple") == 1.0
    assert dice_similarity("apple", "aple") > 0.7
    assert dice_similarity("cat", "dog") == 0.0
    assert dice_similarity("", "test") == 0.0


def test_exact_lookup():
    result = word_lookup_service.lookup("HELLO")
    assert result.found is True
    assert result.match_type in ("exact", "anchor")
    assert result.s3_url is not None


def test_case_insensitivity_and_punctuation():
    result1 = word_lookup_service.lookup("hello")
    result2 = word_lookup_service.lookup("HELLO!")
    assert result1.found is True
    assert result2.found is True
    assert result1.s3_url == result2.s3_url


def test_lookup_gloss_sequence():
    results = word_lookup_service.lookup_gloss_sequence(["HELLO", "YOU"])
    assert len(results) == 2
    assert results[0].found is True
    assert results[1].found is True


def test_semantic_fallback_graceful():
    # Query a word that doesn't exist directly
    result = word_lookup_service.lookup("XYZUNKNOWN12345", use_semantic_fallback=True)
    assert result is not None
    assert result.found is False or result.s3_url is not None


def test_anchor_lookup():
    # 'PC' is an anchor for 'COMPUTER'
    result = word_lookup_service.lookup("PC")
    assert result.found is True
    assert result.word == "COMPUTER"
    assert result.match_type == "anchor"
    assert result.s3_url is not None


def test_compound_and_hyphen_normalization():
    # Hyphen and space normalization: 'DAILY BREAD' and 'DAILY-BREAD' resolve to canonical 'DAILY-BREAD'
    res1 = word_lookup_service.lookup("DAILY-BREAD")
    res2 = word_lookup_service.lookup("DAILY BREAD")
    assert res1.found is True
    assert res2.found is True
    assert res1.word == "DAILY-BREAD"
    assert res2.word == "DAILY-BREAD"
    assert res1.s3_url is not None


def test_substring_false_positives_eliminated():
    # Verify strict elimination of broad substring traps
    assert word_lookup_service.lookup("CARPET", use_semantic_fallback=False).found is False
    assert word_lookup_service.lookup("CAT", use_semantic_fallback=False).found is False
    assert word_lookup_service.lookup("CARE", use_semantic_fallback=False).found is False


def test_unplayable_entries_handled_honestly():
    # Records missing valid S3 URLs are not reported as playable
    assert word_lookup_service.lookup("TWELVE").found is False
    assert word_lookup_service.lookup("MARRIAGE").found is False


def test_approved_synonyms_resolve_correctly():
    # PC -> COMPUTER, PLEASANT -> NICE
    pc_res = word_lookup_service.lookup("PC")
    assert pc_res.found is True
    assert pc_res.word == "COMPUTER"
    assert pc_res.match_type == "anchor"

    pleasant_res = word_lookup_service.lookup("PLEASANT")
    assert pleasant_res.found is True
    assert pleasant_res.word == "NICE"
    assert pleasant_res.match_type == "anchor"


def test_calibrated_semantic_retrieval():
    # AUTOMOBILE -> CAR via calibrated semantic retrieval
    res = word_lookup_service.lookup("AUTOMOBILE", use_semantic_fallback=True)
    assert res.found is True
    assert res.word == "CAR"
    assert res.s3_url is not None


def test_lookup_result_contract_dict():
    result = word_lookup_service.lookup("HELLO")
    d = result.to_dict()
    assert "word" in d
    assert "original_query" in d
    assert "found" in d
    assert "s3_url" in d
    assert "match_type" in d
    assert "similar_words" in d
    assert isinstance(d["similar_words"], list)


def test_morphological_lookup_matching():
    # Plural -> Singular: CARS -> CAR
    res = word_lookup_service.lookup("CARS")
    assert res.found is True
    assert res.word == "CAR"
    assert res.match_type == "partial"
    assert res.s3_url is not None


def test_pruthviraj_fingerspelling_sequence():
    # Name: PRUTHVIRAJ -> P - R - U - T - H - V - I - R - A - J
    letters = word_lookup_service.lookup_fingerspell("PRUTHVIRAJ")
    assert len(letters) == 10
    expected_order = ["P", "R", "U", "T", "H", "V", "I", "R", "A", "J"]
    for idx, (res, exp) in enumerate(zip(letters, expected_order)):
        assert res.word == exp
        assert res.found is True
        assert res.s3_url is not None
        assert f"/{exp}.sigml" in res.s3_url


def test_lookup_gloss_sequence_with_unresolved_name():
    # Sequence with known words and unknown name
    sequence = word_lookup_service.lookup_gloss_sequence(["HELLO", "PRUTHVIRAJ", "YOU"])
    assert len(sequence) == 12  # 1 HELLO + 10 letters + 1 YOU
    assert sequence[0].word == "HELLO"
    for idx, ch in enumerate("PRUTHVIRAJ"):
        assert sequence[1 + idx].word == ch
        assert sequence[1 + idx].found is True
        assert sequence[1 + idx].s3_url is not None
    assert sequence[11].word == "YOU"


def test_unknown_name_not_silently_replaced_by_semantic_search():
    # Direct lookup without semantic search flag returns found=False (for spelling)
    # rather than silently mapping to unrelated words like 'TRUTH'
    res = word_lookup_service.lookup("PRUTHVI", use_semantic_fallback=False)
    assert res.found is False
    assert res.s3_url is None


def test_fingerspelling_multiword_and_digits():
    # Handles multiword names and numbers: "RAJ 1"
    spelled = word_lookup_service.lookup_fingerspell("RAJ 1")
    assert len(spelled) == 4  # R, A, J, 1
    words = [s.word for s in spelled]
    assert words == ["R", "A", "J", "1"]
    assert all(s.found and s.s3_url is not None for s in spelled)


