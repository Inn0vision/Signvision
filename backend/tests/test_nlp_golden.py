"""
SignVision NLP Golden Regression Test Suite
Validates ISL grammar transformation rules, gloss token ordering,
preprocessing, fixed expressions, and semantic slot transformation.

Tests cover:
1. Subject-Object-Verb (SOV) ordering
2. Temporal adverbials & time marker placement
3. Negation placement ('NOT')
4. WH-question and Yes/No question handling ('Q')
5. State and predicative adjective sentences
6. Possessives and identity sentences
7. Fixed expressions & greetings
8. Contraction expansion and sentence segmentation
9. Auxiliary verb & article stripping
10. Fallback and out-of-vocabulary scenarios
"""

import pytest
import sys
from pathlib import Path

# Ensure backend directory is in path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.nlp_engine import (
    preprocess_text,
    apply_isl_rules,
    build_gloss_output,
    _check_fixed_expression,
    CONTRACTION_MAP,
    FIXED_EXPRESSION_MAP,
)


# ==============================================================================
# 1. PREPROCESSING & CONTRACTION TESTS
# ==============================================================================

class TestPreprocessing:
    def test_single_sentence_normalization(self):
        text = "Hello, world!"
        sentences = preprocess_text(text)
        assert sentences == ["hello world"]

    def test_multi_sentence_splitting(self):
        text = "I am eating an apple. Tomorrow I will go to school!"
        sentences = preprocess_text(text)
        assert len(sentences) == 2
        assert sentences[0] == "i am eating an apple"
        assert sentences[1] == "tomorrow i will go to school"

    def test_contraction_expansion_negative(self):
        text = "I don't know and I can't come."
        sentences = preprocess_text(text)
        assert "do not" in sentences[0]
        assert "can not" in sentences[0]

    def test_contraction_expansion_pronouns(self):
        text = "I'm happy and you're welcome."
        sentences = preprocess_text(text)
        assert "i am" in sentences[0]
        assert "you are" in sentences[0]

    def test_empty_and_whitespace_input(self):
        assert preprocess_text("") == []
        assert preprocess_text("   \n\t  ") == []


# ==============================================================================
# 2. FIXED EXPRESSIONS & GREETINGS TESTS
# ==============================================================================

class TestFixedExpressions:
    def test_thank_you(self):
        res = _check_fixed_expression("Thank you!")
        assert res is not None
        assert res["gloss"] == ["THANK YOU"]

    def test_thanks(self):
        res = _check_fixed_expression("thanks")
        assert res is not None
        assert res["gloss"] == ["THANK YOU"]

    def test_good_morning(self):
        res = _check_fixed_expression("Good morning")
        assert res is not None
        assert res["gloss"] == ["GOOD MORNING"]

    def test_good_night(self):
        res = _check_fixed_expression("good night")
        assert res is not None
        assert res["gloss"] == ["GOOD NIGHT"]

    def test_how_are_you_greeting(self):
        res = _check_fixed_expression("how are you")
        assert res is not None
        assert res["gloss"] == ["HOW ARE YOU"]

    def test_non_fixed_expression(self):
        res = _check_fixed_expression("I am going home")
        assert res is None


# ==============================================================================
# 3. CORE ISL GRAMMAR RULE TESTS (SOV, TIME, NEGATION, QUESTIONS)
# ==============================================================================

class TestISLGrammarRules:
    def _transform_and_build(self, parsed_data, tokens):
        transformed = apply_isl_rules(parsed_data, tokens)
        return build_gloss_output(transformed)

    def test_sov_simple_action(self):
        # "I eat apple" -> [I, APPLE, EAT]
        parsed = {
            "subject": "i",
            "object": "apple",
            "normalized_verb": "eat",
            "adjective": None,
            "tense": "PRESENT",
            "negation": False,
            "sentence_type": "statement",
            "has_explicit_time_word": False,
            "requires_time_marker": False,
        }
        tokens = ["i", "eat", "an", "apple"]
        out = self._transform_and_build(parsed, tokens)
        assert out["gloss"] == ["I", "APPLE", "EAT"]

    def test_sov_article_and_auxiliary_stripping(self):
        # Articles ("a", "an", "the") and auxiliaries ("am", "is", "are") must be stripped
        parsed = {
            "subject": "the teacher",
            "object": "a book",
            "normalized_verb": "read",
            "adjective": None,
            "tense": "PRESENT",
            "negation": False,
            "sentence_type": "statement",
            "has_explicit_time_word": False,
            "requires_time_marker": False,
        }
        tokens = ["the", "teacher", "is", "reading", "a", "book"]
        out = self._transform_and_build(parsed, tokens)
        assert out["gloss"] == ["TEACHER", "BOOK", "READ"]

    def test_explicit_time_yesterday_head_position(self):
        # "Yesterday I went to market" -> [YESTERDAY, I, MARKET, GO]
        parsed = {
            "subject": "i",
            "object": "market",
            "normalized_verb": "go",
            "adjective": None,
            "tense": "PAST",
            "negation": False,
            "sentence_type": "statement",
            "has_explicit_time_word": True,
            "requires_time_marker": False,
        }
        tokens = ["yesterday", "i", "went", "to", "market"]
        out = self._transform_and_build(parsed, tokens)
        assert out["gloss"][0] == "YESTERDAY"
        assert out["gloss"] == ["YESTERDAY", "I", "MARKET", "GO"]

    def test_explicit_time_tomorrow_head_position(self):
        # "Tomorrow you will meet friend" -> [TOMORROW, YOU, FRIEND, MEET]
        parsed = {
            "subject": "you",
            "object": "friend",
            "normalized_verb": "meet",
            "adjective": None,
            "tense": "FUTURE",
            "negation": False,
            "sentence_type": "statement",
            "has_explicit_time_word": True,
            "requires_time_marker": False,
        }
        tokens = ["tomorrow", "you", "will", "meet", "friend"]
        out = self._transform_and_build(parsed, tokens)
        assert out["gloss"] == ["TOMORROW", "YOU", "FRIEND", "MEET"]

    def test_implicit_time_marker_generation(self):
        # Action sentence with no explicit time word but requires_time_marker=True
        parsed = {
            "subject": "he",
            "object": "ball",
            "normalized_verb": "kick",
            "adjective": None,
            "tense": "PAST",
            "negation": False,
            "sentence_type": "statement",
            "has_explicit_time_word": False,
            "requires_time_marker": True,
        }
        tokens = ["he", "kicked", "the", "ball"]
        out = self._transform_and_build(parsed, tokens)
        assert out["gloss"] == ["YESTERDAY", "HE", "BALL", "KICK"]

    def test_negation_placement(self):
        # "I do not know" -> [I, KNOW, NOT]
        parsed = {
            "subject": "i",
            "object": None,
            "normalized_verb": "know",
            "adjective": None,
            "tense": "PRESENT",
            "negation": True,
            "sentence_type": "statement",
            "has_explicit_time_word": False,
            "requires_time_marker": False,
        }
        tokens = ["i", "do", "not", "know"]
        out = self._transform_and_build(parsed, tokens)
        assert out["gloss"] == ["I", "KNOW", "NOT"]

    def test_negation_with_object(self):
        # "She does not eat meat" -> [SHE, MEAT, EAT, NOT]
        parsed = {
            "subject": "she",
            "object": "meat",
            "normalized_verb": "eat",
            "adjective": None,
            "tense": "PRESENT",
            "negation": True,
            "sentence_type": "statement",
            "has_explicit_time_word": False,
            "requires_time_marker": False,
        }
        tokens = ["she", "does", "not", "eat", "meat"]
        out = self._transform_and_build(parsed, tokens)
        assert out["gloss"] == ["SHE", "MEAT", "EAT", "NOT"]

    def test_wh_question_end_position(self):
        # "Where are you going?" -> [YOU, GO, WHERE]
        parsed = {
            "subject": "you",
            "object": None,
            "normalized_verb": "go",
            "adjective": None,
            "tense": "PRESENT",
            "negation": False,
            "sentence_type": "wh_question",
            "has_explicit_time_word": False,
            "requires_time_marker": False,
        }
        tokens = ["where", "are", "you", "going"]
        out = self._transform_and_build(parsed, tokens)
        assert out["gloss"] == ["YOU", "GO", "WHERE"]

    def test_what_wh_question(self):
        # "What do you like?" -> [YOU, LIKE, WHAT]
        parsed = {
            "subject": "you",
            "object": None,
            "normalized_verb": "like",
            "adjective": None,
            "tense": "PRESENT",
            "negation": False,
            "sentence_type": "wh_question",
            "has_explicit_time_word": False,
            "requires_time_marker": False,
        }
        tokens = ["what", "do", "you", "like"]
        out = self._transform_and_build(parsed, tokens)
        assert out["gloss"] == ["YOU", "LIKE", "WHAT"]

    def test_yes_no_question_marker(self):
        # "Are you coming?" -> [YOU, COME, Q]
        parsed = {
            "subject": "you",
            "object": None,
            "normalized_verb": "come",
            "adjective": None,
            "tense": "PRESENT",
            "negation": False,
            "sentence_type": "yes_no_question",
            "has_explicit_time_word": False,
            "requires_time_marker": False,
        }
        tokens = ["are", "you", "coming"]
        out = self._transform_and_build(parsed, tokens)
        assert out["gloss"] == ["YOU", "COME", "Q"]

    def test_state_sentence_predicative_adjective(self):
        # "I am sick" -> [I, SICK]
        parsed = {
            "subject": "i",
            "object": None,
            "normalized_verb": None,
            "adjective": "sick",
            "tense": "PRESENT",
            "negation": False,
            "sentence_type": "statement",
            "has_explicit_time_word": False,
            "requires_time_marker": False,
        }
        tokens = ["i", "am", "sick"]
        out = self._transform_and_build(parsed, tokens)
        assert out["gloss"] == ["I", "SICK"]

    def test_state_sentence_happy(self):
        # "She is happy" -> [SHE, HAPPY]
        parsed = {
            "subject": "she",
            "object": None,
            "normalized_verb": None,
            "adjective": "happy",
            "tense": "PRESENT",
            "negation": False,
            "sentence_type": "statement",
            "has_explicit_time_word": False,
            "requires_time_marker": False,
        }
        tokens = ["she", "is", "happy"]
        out = self._transform_and_build(parsed, tokens)
        assert out["gloss"] == ["SHE", "HAPPY"]

    def test_state_negative_sentence(self):
        # "He is not tired" -> [HE, TIRED, NOT]
        parsed = {
            "subject": "he",
            "object": None,
            "normalized_verb": None,
            "adjective": "tired",
            "tense": "PRESENT",
            "negation": True,
            "sentence_type": "statement",
            "has_explicit_time_word": False,
            "requires_time_marker": False,
        }
        tokens = ["he", "is", "not", "tired"]
        out = self._transform_and_build(parsed, tokens)
        assert out["gloss"] == ["HE", "TIRED", "NOT"]

    def test_possessive_structure(self):
        # "What is your name?" -> [YOU, NAME, WHAT]
        parsed = {
            "subject": "you",
            "object": "name",
            "normalized_verb": None,
            "adjective": None,
            "tense": "PRESENT",
            "negation": False,
            "sentence_type": "wh_question",
            "has_explicit_time_word": False,
            "requires_time_marker": False,
        }
        tokens = ["what", "is", "your", "name"]
        out = self._transform_and_build(parsed, tokens)
        assert out["gloss"] == ["YOU", "NAME", "WHAT"]

    def test_identity_statement(self):
        # "This is Sakshi" -> [THIS, SAKSHI]
        parsed = {
            "subject": "this",
            "object": "sakshi",
            "normalized_verb": None,
            "adjective": None,
            "tense": "PRESENT",
            "negation": False,
            "sentence_type": "statement",
            "has_explicit_time_word": False,
            "requires_time_marker": False,
        }
        tokens = ["this", "is", "sakshi"]
        out = self._transform_and_build(parsed, tokens)
        assert out["gloss"] == ["THIS", "SAKSHI"]

    def test_future_intention_going_to(self):
        # "I am going to school tomorrow" -> [TOMORROW, I, SCHOOL, GO]
        parsed = {
            "subject": "i",
            "object": "school",
            "normalized_verb": "go",
            "adjective": None,
            "tense": "FUTURE",
            "negation": False,
            "sentence_type": "statement",
            "has_explicit_time_word": True,
            "requires_time_marker": False,
        }
        tokens = ["i", "am", "going", "to", "school", "tomorrow"]
        out = self._transform_and_build(parsed, tokens)
        assert out["gloss"] == ["TOMORROW", "I", "SCHOOL", "GO"]

    def test_compound_temporal_last_night(self):
        # "Last night we watched movie" -> [LAST NIGHT, WE, MOVIE, WATCH]
        parsed = {
            "subject": "we",
            "object": "movie",
            "normalized_verb": "watch",
            "adjective": None,
            "tense": "PAST",
            "negation": False,
            "sentence_type": "statement",
            "has_explicit_time_word": True,
            "requires_time_marker": False,
        }
        tokens = ["last", "night", "we", "watched", "a", "movie"]
        out = self._transform_and_build(parsed, tokens)
        assert out["gloss"][0] == "LAST NIGHT"
        assert out["gloss"] == ["LAST NIGHT", "WE", "MOVIE", "WATCH"]

    def test_multiple_objects_handling(self):
        # Multiple objects in a list
        parsed = {
            "subject": "i",
            "object": ["book", "pen"],
            "normalized_verb": "buy",
            "adjective": None,
            "tense": "PRESENT",
            "negation": False,
            "sentence_type": "statement",
            "has_explicit_time_word": False,
            "requires_time_marker": False,
        }
        tokens = ["i", "buy", "a", "book", "and", "a", "pen"]
        out = self._transform_and_build(parsed, tokens)
        assert "BOOK PEN" in out["gloss"] or (
            out["gloss"] == ["I", "BOOK PEN", "BUY"]
        )

    def test_fallback_extraction_negation_and_question(self):
        from app.core.nlp_engine import _fallback_extraction, analyze_text
        analysis = analyze_text("why are you not coming")
        fallback = _fallback_extraction("why are you not coming", analysis)
        assert fallback["negation"] is True
        assert fallback["sentence_type"] == "wh_question"

    def test_groq_single_call_per_sentence_and_call_parameters(self):
        from unittest.mock import patch, MagicMock
        from app.core.nlp_engine import call_llm, process_text, _build_llm_prompt

        # Test prompt structure
        prompt = _build_llm_prompt("I eat apple", ["i", "eat", "apple"], ["PRON", "VERB", "NOUN"])
        assert "Sentence: \"I eat apple\"" in prompt
        assert "normalized_verb" in prompt
        assert "confidence" in prompt
        assert len(prompt) < 2000  # verified concise prompt

        mock_completion = MagicMock()
        mock_completion.choices = [
            MagicMock(message=MagicMock(content="""{
                "subject": "i",
                "object": "apple",
                "tense": "PRESENT",
                "negation": false,
                "sentence_type": "statement",
                "normalized_verb": "eat",
                "adjective": null,
                "important_phrases": [],
                "has_explicit_time_word": false,
                "requires_time_marker": true,
                "confidence": 95
            }"""))
        ]
        mock_completion.usage = MagicMock(prompt_tokens=150, completion_tokens=80, total_tokens=230)

        with patch("app.core.nlp_engine.llm_client.chat.completions.create", return_value=mock_completion) as mock_create:
            # Groq semantic extraction -> exactly 1 Groq API call
            from app.core.nlp_engine import detect_phrases_llm
            result = detect_phrases_llm("I eat apple", {"tokens": ["i", "eat", "apple"], "pos": ["PRON", "VERB", "NOUN"]})
            assert result["subject"] == "i"
            assert mock_create.call_count == 1

            # Verify call parameters
            kwargs = mock_create.call_args.kwargs
            assert kwargs["max_tokens"] == 256
            assert kwargs["stream"] is False

    def test_groq_bounded_retries_on_transient_network_error(self):
        from unittest.mock import patch, MagicMock
        from app.core.nlp_engine import call_llm

        mock_completion = MagicMock()
        mock_completion.choices = [
            MagicMock(message=MagicMock(content='{"subject": "you", "object": null, "tense": "PRESENT", "negation": false, "sentence_type": "wh_question", "normalized_verb": "like", "adjective": null, "important_phrases": [], "has_explicit_time_word": false, "requires_time_marker": false, "confidence": 95}'))
        ]
        mock_completion.usage = None

        # Fail attempt 1 with network error, succeed attempt 2
        with patch("app.core.nlp_engine.llm_client.chat.completions.create", side_effect=[ConnectionError("Temporary network reset"), mock_completion]) as mock_create:
            with patch("time.sleep", return_value=None):
                res = call_llm("dummy prompt")
                assert res["subject"] == "you"
                assert mock_create.call_count == 2

    def test_unicode_curly_apostrophes_and_contractions(self):
        # Curly apostrophes: ’ and ‘
        text = "I don’t know and he’s happy."
        sentences = preprocess_text(text)
        assert len(sentences) == 1
        assert "do not" in sentences[0]
        assert "he is" in sentences[0]

    def test_multi_sentence_splitting_semicolons_newlines(self):
        text = "I eat apple; tomorrow I go school\nhe is happy"
        sentences = preprocess_text(text)
        assert len(sentences) == 3
        assert sentences[0] == "i eat apple"
        assert sentences[1] == "tomorrow i go school"
        assert sentences[2] == "he is happy"

    def test_malformed_llm_json_sanitization(self):
        from unittest.mock import patch
        from app.core.nlp_engine import detect_phrases_llm, analyze_text
        # Malformed LLM output: list instead of string for object, non-standard casing, missing fields
        mock_raw = {
            "subject": "  he  ",
            "object": ["book", "pen"],
            "tense": "past_custom",
            "negation": 1,
            "sentence_type": "WH_QUESTION",
            "normalized_verb": " READ ",
            "adjective": None,
        }
        with patch("app.core.nlp_engine.call_llm", return_value=mock_raw):
            analysis = analyze_text("what did he read")
            result = detect_phrases_llm("what did he read", analysis)
            assert result["subject"] == "he"
            assert result["object"] == ["book", "pen"]
            assert result["tense"] == "PRESENT"  # defaulted from invalid tense
            assert result["negation"] is True
            assert result["sentence_type"] == "wh_question"
            assert result["normalized_verb"] == "read"
            assert result["has_explicit_time_word"] is False
            assert result["requires_time_marker"] is False

    def test_fallback_predicative_adjective_pure_python(self):
        from unittest.mock import patch
        from app.core.nlp_engine import _fallback_extraction, analyze_text
        with patch("app.core.nlp_engine.nlp", None):
            analysis = analyze_text("I am sick")
            extracted = _fallback_extraction("I am sick", analysis)
            assert extracted["subject"] == "i"
            assert extracted["adjective"] == "sick"
            assert extracted["negation"] is False
            assert extracted["sentence_type"] == "statement"

    def test_fallback_explicit_time_phrase(self):
        from unittest.mock import patch
        from app.core.nlp_engine import _fallback_extraction, analyze_text
        with patch("app.core.nlp_engine.nlp", None):
            analysis = analyze_text("yesterday I ate food")
            extracted = _fallback_extraction("yesterday I ate food", analysis)
            assert extracted["has_explicit_time_word"] is True
            assert extracted["tense"] == "PAST"



