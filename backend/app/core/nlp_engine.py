import re
import json
import logging
from typing import List, Dict, Any, Optional

try:
    import spacy
    nlp = spacy.load("en_core_web_sm")
except Exception:
    nlp = None

from groq import Groq

from .config import settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger("nlp_engine")


def _mask_key(key: str) -> str:
    if not key or len(key) < 12:
        return "***"
    return f"{key[:8]}...{key[-4:]}"


class GroqKeyManager:
    """Manages active Groq API key and automatic failover across configured keys."""

    def __init__(self):
        self.keys: list[str] = settings.get_groq_api_keys()
        self.current_index: int = 0
        self.invalid_keys: set[str] = set()

    def refresh_keys(self) -> None:
        self.keys = settings.get_groq_api_keys()

    def get_active_key(self) -> str:
        if not self.keys:
            self.refresh_keys()
        if not self.keys:
            return settings.GROQ_API_KEY or ""
        for _ in range(len(self.keys)):
            key = self.keys[self.current_index]
            if key not in self.invalid_keys:
                return key
            self.current_index = (self.current_index + 1) % len(self.keys)
        self.invalid_keys.clear()
        return self.keys[self.current_index]

    def rotate_key(self, mark_invalid: bool = False) -> str:
        if not self.keys:
            self.refresh_keys()
        if not self.keys:
            return ""

        failed_key = self.keys[self.current_index]
        if mark_invalid:
            self.invalid_keys.add(failed_key)

        prev_idx = self.current_index
        self.current_index = (self.current_index + 1) % len(self.keys)
        next_key = self.get_active_key()
        logger.warning(
            f"Groq API key failover: switching from {_mask_key(failed_key)} (key #{prev_idx + 1}) "
            f"to {_mask_key(next_key)} (key #{self.current_index + 1} of {len(self.keys)})"
        )
        return next_key


groq_key_manager = GroqKeyManager()

llm_client = Groq(
    api_key=groq_key_manager.get_active_key() or settings.GROQ_API_KEY,
)

AUXILIARY_VERBS = {
    "is",
    "am",
    "are",
    "was",
    "were",
    "does",
    "did",
    "have",
    "has",
    "had",
    "will",
    "would",
    "shall",
    "should",
    "can",
    "could",
    "may",
    "might",
    "must",
    "being",
    "been",
    "going",
    "gonna",
}

ARTICLES = {"a", "an", "the"}
DETERMINERS = {"a", "an", "the", "this", "that", "these", "those"}
STATE_VERBS = {"be", "feel", "seem", "appear", "look", "sound", "smell", "taste"}
WH_WORDS = {"what", "where", "why", "how", "who", "which", "when", "whom", "whose"}

CONTRACTION_MAP = {
    "don't": "do not",
    "dont": "do not",
    "doesn't": "does not",
    "doesnt": "does not",
    "didn't": "did not",
    "didnt": "did not",
    "won't": "will not",
    "wont": "will not",
    "wouldn't": "would not",
    "wouldnt": "would not",
    "can't": "can not",
    "cant": "can not",
    "cannot": "can not",
    "couldn't": "could not",
    "couldnt": "could not",
    "shouldn't": "should not",
    "shouldnt": "should not",
    "isn't": "is not",
    "isnt": "is not",
    "aren't": "are not",
    "arent": "are not",
    "wasn't": "was not",
    "wasnt": "was not",
    "weren't": "were not",
    "werent": "were not",
    "haven't": "have not",
    "havent": "have not",
    "hasn't": "has not",
    "hasnt": "has not",
    "hadn't": "had not",
    "hadnt": "had not",
    "mustn't": "must not",
    "mustnt": "must not",
    "needn't": "need not",
    "neednt": "need not",
    "i'm": "i am",
    "im": "i am",
    "you're": "you are",
    "youre": "you are",
    "he's": "he is",
    "she's": "she is",
    "it's": "it is",
    "we're": "we are",
    "they're": "they are",
    "theyre": "they are",
    "i've": "i have",
    "ive": "i have",
    "you've": "you have",
    "youve": "you have",
    "we've": "we have",
    "weve": "we have",
    "they've": "they have",
    "theyve": "they have",
    "i'll": "i will",
    "ill": "i will",
    "you'll": "you will",
    "youll": "you will",
    "he'll": "he will",
    "she'll": "she will",
    "we'll": "we will",
    "they'll": "they will",
    "i'd": "i would",
    "you'd": "you would",
    "he'd": "he would",
    "she'd": "she would",
    "we'd": "we would",
    "they'd": "they would",
}

TIME_MARKER_MAP = {
    "PAST": "YESTERDAY",
    "PRESENT": "NOW",
    "FUTURE": "FUTURE",
}

FIXED_EXPRESSION_MAP = {
    "thank you": "THANK YOU",
    "thank you very much": "THANK YOU",
    "thanks": "THANK YOU",
    "how are you": "HOW ARE YOU",
    "how are you doing": "HOW ARE YOU",
    "good morning": "GOOD MORNING",
    "good night": "GOOD NIGHT",
    "good evening": "GOOD EVENING",
    "good afternoon": "GOOD AFTERNOON",
}
SORTED_FIXED = sorted(
    FIXED_EXPRESSION_MAP.keys(), key=lambda p: len(p.split()), reverse=True
)

MAX_LLM_RETRIES = 2


def preprocess_text(text: str) -> List[str]:
    if not text or not text.strip():
        return []

    # Normalize unicode apostrophes/quotes
    normalized = text.replace("’", "'").replace("‘", "'").replace("`", "'")
    normalized = normalized.lower().strip()

    # Expand contractions
    for contraction, expansion in CONTRACTION_MAP.items():
        normalized = re.sub(
            r"\b" + re.escape(contraction) + r"\b",
            expansion,
            normalized,
        )

    # Split on sentence boundaries (. ! ? ; or newline)
    raw_sentences = re.split(r"(?:[.!?;\n]+)\s*", normalized)

    sentences = []
    for sentence in raw_sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        # Strip remaining non-alphanumeric punctuation while keeping whitespace
        sentence = re.sub(r"[^\w\s]", "", sentence)
        sentence = re.sub(r"\s+", " ", sentence).strip()
        if sentence:
            sentences.append(sentence)

    logger.info(f"Preprocessed into {len(sentences)} sentence(s): {sentences}")
    return sentences


def _tag_token_pos(token: str) -> str:
    lower = token.lower()
    if lower in {"i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them", "my", "your", "his", "their", "our", "this", "that", "these", "those"}:
        return "PRON"
    if lower in AUXILIARY_VERBS:
        return "AUX"
    if lower in ARTICLES:
        return "DET"
    if lower in {"not", "never", "no"}:
        return "PART"
    if lower in WH_WORDS:
        return "PRON"
    if lower in {"to", "in", "at", "on", "for", "with", "from", "of", "by", "about", "into", "through"}:
        return "ADP"
    if lower in STATE_VERBS or lower in {"eat", "eating", "ate", "go", "going", "went", "like", "likes", "liked", "see", "saw", "play", "played", "come", "came", "buy", "read", "meet", "watch", "kick", "know", "drink", "help", "work", "sleep", "study", "walk", "run"}:
        return "VERB"
    if lower in {"sick", "happy", "tired", "hungry", "good", "bad", "big", "small", "fine", "sad", "angry", "cold", "hot", "thirsty"}:
        return "ADJ"
    return "NOUN"


def analyze_text(sentence: str) -> Dict[str, List[str]]:
    """Lightweight pure-Python tokenizer and POS tagger providing linguistic hints to Groq."""
    if nlp is not None:
        try:
            doc = nlp(sentence)
            tokens = [token.text for token in doc]
            pos_tags = [token.pos_ for token in doc]
            logger.info(f"Linguistic analysis - tokens: {tokens}, POS: {pos_tags}")
            return {"tokens": tokens, "pos": pos_tags}
        except Exception as e:
            logger.warning(f"spaCy analysis failed: {e}, falling back to lightweight tokenizer")

    tokens = re.findall(r"\w+|[^\w\s]", sentence)
    pos_tags = [_tag_token_pos(t) for t in tokens]
    logger.info(f"Linguistic analysis (lightweight) - tokens: {tokens}, POS: {pos_tags}")
    return {"tokens": tokens, "pos": pos_tags}


def _build_llm_prompt(sentence: str, tokens: List[str], pos_tags: List[str]) -> str:
    return f"""You are an NLP semantic extraction engine for Indian Sign Language (ISL).
Extract structured meaning from the English sentence. Do NOT generate ISL gloss.

Input:
Sentence: "{sentence}"
Tokens: {tokens}
POS Tags: {pos_tags}

Instructions:
1. "subject": main subject pronoun or entity (e.g. "i", "you", "he", "she", "we"). For possessive phrases (e.g. "your name", "my book"), extract the possessor pronoun ("you", "i") as subject. For identity sentences ("this is...", "she is my friend"), subject is the first entity.
2. "object": real entity receiving action, identity complement, or possessed noun. Never include WH-words. If none, null.
3. "tense": "PAST", "PRESENT", or "FUTURE" ("going to" indicates FUTURE).
4. "negation": true if negative (not, never, no), else false.
5. "sentence_type": "statement", "yes_no_question", or "wh_question".
6. "normalized_verb": base root action verb (e.g. "eat", "go", "like", "do"). Never auxiliary verbs (is, am, are, was, were). For state sentences ("I am sick", "She is happy") or greetings, set to null.
7. "adjective": predicative adjective describing state (e.g. "sick", "happy", "tired", "hungry"), else null.
8. "important_phrases": list of objects with "phrase" and "meaning" if relevant, else [].
9. "has_explicit_time_word": true if explicit time words (e.g. yesterday, today, tomorrow, now), else false.
10. "requires_time_marker": true for action sentences needing temporal markers, false for state/greeting/continuous questions.
11. "confidence": integer (0-100).

Return ONLY a valid JSON object matching this schema with NO extra commentary or explanation:
{{
  "subject": "...",
  "object": null,
  "tense": "PRESENT",
  "negation": false,
  "sentence_type": "statement",
  "normalized_verb": "...",
  "adjective": null,
  "important_phrases": [],
  "has_explicit_time_word": false,
  "requires_time_marker": false,
  "confidence": 98
}}"""


_LLM_EXTRACTION_CACHE: Dict[str, Dict[str, Any]] = {}
_MAX_LLM_CACHE_SIZE: int = 1000


def clear_nlp_cache() -> None:
    _LLM_EXTRACTION_CACHE.clear()
    _PROCESS_TEXT_CACHE.clear()


def call_llm(prompt: str, max_tokens: int = 256) -> Dict[str, Any]:
    """Call Groq LLM with automatic key failover across fallback keys and network retries."""
    import time
    from groq import AuthenticationError, RateLimitError

    available_keys = groq_key_manager.keys or [settings.GROQ_API_KEY]
    # Each key gets at least 1 attempt, with a minimum of 2 attempts total
    max_network_attempts = max(2, len(available_keys))
    last_error: Optional[Exception] = None
    json_mode_failed = False

    for attempt in range(1, max_network_attempts + 1):
        active_key = groq_key_manager.get_active_key()
        if active_key and hasattr(llm_client, "api_key") and llm_client.api_key != active_key:
            llm_client.api_key = active_key

        current_key_display = _mask_key(active_key)
        logger.info(f"LLM call attempt {attempt}/{max_network_attempts} (key: {current_key_display})")
        start_time = time.perf_counter()

        try:
            kwargs: Dict[str, Any] = {
                "model": settings.GROQ_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "top_p": 0.95,
                "max_tokens": max_tokens,
                "stream": False,
            }
            # Attempt structured JSON mode if supported by model/client and not previously failed
            if not json_mode_failed and "json" in prompt.lower():
                try:
                    kwargs["response_format"] = {"type": "json_object"}
                except Exception:
                    pass

            completion = llm_client.chat.completions.create(**kwargs)

            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            usage = getattr(completion, "usage", None)
            prompt_tokens = getattr(usage, "prompt_tokens", None) if usage else None
            completion_tokens = getattr(usage, "completion_tokens", None) if usage else None
            total_tokens = getattr(usage, "total_tokens", None) if usage else None

            logger.info(
                f"Groq LLM call succeeded - model: {settings.GROQ_MODEL}, "
                f"key: {current_key_display}, attempt: {attempt}, latency: {latency_ms}ms, "
                f"tokens: [prompt={prompt_tokens}, completion={completion_tokens}, total={total_tokens}]"
            )

            response_text = completion.choices[0].message.content or ""
            return _parse_llm_json(response_text)

        except Exception as e:
            last_error = e
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
            is_auth_error = isinstance(e, AuthenticationError)
            is_rate_limit = isinstance(e, RateLimitError) or "429" in str(e) or "rate limit" in str(e).lower()
            if "json_validate_failed" in str(e):
                json_mode_failed = True

            logger.warning(
                f"Groq LLM call failed on attempt {attempt}/{max_network_attempts} "
                f"with key {current_key_display} ({latency_ms}ms): {type(e).__name__}: {e}"
            )

            # Failover to next key if auth failed, rate limit hit, or multiple keys configured
            if is_auth_error or is_rate_limit or len(available_keys) > 1:
                next_key = groq_key_manager.rotate_key(mark_invalid=is_auth_error)
                if hasattr(llm_client, "api_key") and next_key:
                    llm_client.api_key = next_key

            if attempt == max_network_attempts:
                raise ValueError(
                    f"LLM call failed after {max_network_attempts} attempts across {len(available_keys)} keys: {last_error}"
                )
            time.sleep(0.5)

    raise ValueError(f"LLM call failed: {last_error}")


def _parse_llm_json(response_text: str) -> Dict[str, Any]:
    text = response_text.strip()

    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass

    code_block_pattern = r"```(?:json)?\s*\n?(.*?)\n?\s*```"
    match = re.search(code_block_pattern, text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(1).strip())
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass

    brace_start = text.find("{")
    brace_end = text.rfind("}")
    if brace_start != -1 and brace_end != -1 and brace_end > brace_start:
        try:
            data = json.loads(text[brace_start : brace_end + 1])
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse valid JSON from LLM response: {text[:200]}")


def detect_phrases_llm(sentence: str, analysis: Dict[str, List[str]]) -> Dict[str, Any]:
    norm_key = re.sub(r"\s+", " ", sentence.strip().lower())
    if norm_key in _LLM_EXTRACTION_CACHE:
        logger.info(f"LLM extraction cache hit for: {norm_key!r}")
        return dict(_LLM_EXTRACTION_CACHE[norm_key])

    prompt = _build_llm_prompt(sentence, analysis["tokens"], analysis["pos"])
    parsed = call_llm(prompt)

    if not isinstance(parsed, dict):
        raise ValueError(f"Malformed LLM response: expected dict, got {type(parsed).__name__}")

    raw_subject = parsed.get("subject")
    subject = str(raw_subject).strip() if raw_subject and isinstance(raw_subject, str) else None

    raw_object = parsed.get("object")
    if isinstance(raw_object, list):
        obj = [str(item).strip() for item in raw_object if item]
    elif raw_object and isinstance(raw_object, str):
        obj = raw_object.strip()
    else:
        obj = None

    raw_tense = str(parsed.get("tense", "PRESENT")).upper()
    tense = raw_tense if raw_tense in ("PAST", "PRESENT", "FUTURE") else "PRESENT"

    raw_type = str(parsed.get("sentence_type", "statement")).lower()
    sentence_type = raw_type if raw_type in ("statement", "yes_no_question", "wh_question") else "statement"

    raw_verb = parsed.get("normalized_verb")
    normalized_verb = str(raw_verb).strip().lower() if raw_verb and isinstance(raw_verb, str) else None

    raw_adj = parsed.get("adjective")
    adjective = str(raw_adj).strip().lower() if raw_adj and isinstance(raw_adj, str) else None

    important_phrases = parsed.get("important_phrases", [])
    if not isinstance(important_phrases, list):
        important_phrases = []

    result = {
        "subject": subject,
        "object": obj,
        "tense": tense,
        "negation": bool(parsed.get("negation", False)),
        "sentence_type": sentence_type,
        "normalized_verb": normalized_verb,
        "adjective": adjective,
        "important_phrases": important_phrases,
        "has_explicit_time_word": bool(parsed.get("has_explicit_time_word", False)),
        "requires_time_marker": bool(parsed.get("requires_time_marker", False)),
    }

    logger.info(f"LLM semantic extraction: {result}")

    if len(_LLM_EXTRACTION_CACHE) >= _MAX_LLM_CACHE_SIZE:
        _LLM_EXTRACTION_CACHE.pop(next(iter(_LLM_EXTRACTION_CACHE)))
    _LLM_EXTRACTION_CACHE[norm_key] = result

    return result


def apply_isl_rules(parsed_data: Dict[str, Any], tokens: List[str]) -> Dict[str, Any]:
    subject = parsed_data.get("subject")
    obj = parsed_data.get("object")
    verb = parsed_data.get("normalized_verb")
    adjective = parsed_data.get("adjective")
    tense = parsed_data.get("tense", "PRESENT")
    negation = parsed_data.get("negation", False)
    sentence_type = parsed_data.get("sentence_type", "statement")
    has_explicit_time = parsed_data.get("has_explicit_time_word", False)
    requires_time = parsed_data.get("requires_time_marker", False)

    if subject:
        subject_words = subject.lower().split()
        subject_words = [
            w for w in subject_words if w not in ARTICLES and w not in AUXILIARY_VERBS
        ]
        subject = " ".join(subject_words) if subject_words else None

    if obj:
        if isinstance(obj, list):
            cleaned_objects = []
            for o in obj:
                obj_words = str(o).lower().split()
                obj_words = [
                    w
                    for w in obj_words
                    if w not in ARTICLES and w not in AUXILIARY_VERBS
                ]
                if obj_words:
                    cleaned_objects.append(" ".join(obj_words))
            obj = " ".join(cleaned_objects) if cleaned_objects else None
        else:
            obj_words = str(obj).lower().split()
            obj_words = [
                w for w in obj_words if w not in ARTICLES and w not in AUXILIARY_VERBS
            ]
            obj = " ".join(obj_words) if obj_words else None

    if verb:
        verb = verb.lower().strip()
        if verb in AUXILIARY_VERBS:
            verb = None

    is_state_sentence = False
    if verb and verb in STATE_VERBS:
        is_state_sentence = True
    if not verb and (obj or adjective) and not negation:
        lower_tokens = [t.lower() for t in tokens]
        if any(aux in lower_tokens for aux in ("am", "is", "are", "was", "were")):
            is_state_sentence = True

    question_word = None
    is_question = False
    if sentence_type == "wh_question":
        is_question = True
        lower_tokens = [t.lower() for t in tokens]
        for w in lower_tokens:
            if w in WH_WORDS:
                question_word = w
                break
    elif sentence_type == "yes_no_question":
        is_question = True

    time_marker = None
    if requires_time and not has_explicit_time and not is_state_sentence:
        time_marker = TIME_MARKER_MAP.get(tense)

    explicit_time_words = []
    if has_explicit_time:
        temporal_keywords = {
            "yesterday",
            "today",
            "tomorrow",
            "tonight",
            "morning",
            "afternoon",
            "evening",
            "night",
            "now",
            "later",
            "soon",
        }
        temporal_modifiers = {"last", "next", "this", "every"}
        lower_tokens = [t.lower() for t in tokens]
        i = 0
        while i < len(lower_tokens):
            if (
                lower_tokens[i] in temporal_modifiers
                and i + 1 < len(lower_tokens)
                and lower_tokens[i + 1] in temporal_keywords
            ):
                explicit_time_words.append(f"{lower_tokens[i]} {lower_tokens[i + 1]}")
                i += 2
                continue
            if lower_tokens[i] in temporal_keywords:
                explicit_time_words.append(lower_tokens[i])
            i += 1

    result = {
        "subject": subject,
        "object": obj,
        "verb": verb,
        "adjective": adjective,
        "tense": tense,
        "negation": negation,
        "question": is_question,
        "question_word": question_word,
        "sentence_type": sentence_type,
        "time_marker": time_marker,
        "explicit_time_words": explicit_time_words,
        "is_state_sentence": is_state_sentence,
    }

    logger.info(f"ISL rule transformation: {result}")
    return result


def build_gloss_output(transformed: Dict[str, Any]) -> Dict[str, Any]:
    gloss_tokens = []

    subject = transformed.get("subject")
    obj = transformed.get("object")
    verb = transformed.get("verb")
    adjective = transformed.get("adjective")
    tense = transformed.get("tense", "PRESENT")
    negation = transformed.get("negation", False)
    is_question = transformed.get("question", False)
    question_word = transformed.get("question_word")
    time_marker = transformed.get("time_marker")
    explicit_time_words = transformed.get("explicit_time_words", [])

    if explicit_time_words:
        for tw in explicit_time_words:
            gloss_tokens.append(tw.upper())
    elif time_marker:
        gloss_tokens.append(time_marker.upper())

    if subject:
        gloss_tokens.append(subject.upper())

    if obj:
        gloss_tokens.append(obj.upper())

    if verb:
        gloss_tokens.append(verb.upper())

    if adjective:
        gloss_tokens.append(adjective.upper())

    if negation:
        gloss_tokens.append("NOT")

    if question_word:
        gloss_tokens.append(question_word.upper())

    if is_question and not question_word:
        gloss_tokens.append("Q")

    output = {
        "subject": subject.upper() if subject else None,
        "object": obj.upper() if obj else None,
        "verb": verb.upper() if verb else None,
        "tense": tense,
        "negation": negation,
        "question": is_question,
        "gloss": gloss_tokens,
    }

    logger.info(f"Gloss output: {output}")
    return output


def _check_fixed_expression(sentence: str) -> Optional[Dict[str, Any]]:
    lower = sentence.lower().strip()
    lower_clean = re.sub(r"[^\w\s]", "", lower).strip()

    for phrase in SORTED_FIXED:
        if lower_clean == phrase:
            gloss_text = FIXED_EXPRESSION_MAP[phrase]
            return {
                "subject": None,
                "object": None,
                "verb": None,
                "tense": "PRESENT",
                "negation": False,
                "question": False,
                "gloss": [gloss_text],
            }
    return None


def _fallback_extraction(sentence: str, analysis: Dict) -> Dict[str, Any]:
    """
    Pure-Python deterministic extraction fallback when LLM is unavailable.
    Accurately extracts subject, object, tense, negation, sentence type, and normalized verb.
    """
    if nlp is not None:
        try:
            doc = nlp(sentence)
            subject = None
            obj = None
            verb = None
            negation = False
            sentence_type = "statement"

            adjective = None
            for token in doc:
                if token.dep_ in ("nsubj", "nsubjpass") and not subject:
                    subject = token.text.lower()
                elif token.dep_ == "ROOT" and token.pos_ in ("VERB", "AUX"):
                    if token.lower_ not in AUXILIARY_VERBS:
                        verb = token.lemma_.lower()
                elif token.dep_ in ("dobj", "pobj"):
                    if token.lower_ not in ARTICLES and token.lower_ not in AUXILIARY_VERBS:
                        obj = token.lemma_.lower()
                elif token.dep_ == "attr":
                    if token.lower_ not in ARTICLES and token.lower_ not in AUXILIARY_VERBS:
                        if token.pos_ == "ADJ":
                            adjective = token.lemma_.lower()
                        else:
                            obj = token.lemma_.lower()
                elif token.dep_ == "acomp":
                    adjective = token.lemma_.lower()
                elif token.dep_ == "neg":
                    negation = True
                elif token.dep_ == "xcomp" and token.pos_ == "VERB":
                    if not verb:
                        verb = token.lemma_.lower()

            lower_tokens = [t.lower() for t in analysis.get("tokens", [])]
            for w in lower_tokens:
                if w in WH_WORDS:
                    sentence_type = "wh_question"
                    break

            if sentence_type == "statement" and lower_tokens:
                if lower_tokens[0] in AUXILIARY_VERBS or sentence.strip().endswith("?"):
                    sentence_type = "yes_no_question"

            tense = "PRESENT"
            if any(w in lower_tokens for w in ("was", "were", "did", "had", "yesterday", "last")):
                tense = "PAST"
            elif any(w in lower_tokens for w in ("will", "shall", "going", "tomorrow", "next")):
                tense = "FUTURE"

            has_explicit_time = any(
                w in lower_tokens
                for w in ("yesterday", "today", "tomorrow", "tonight", "now", "later", "soon")
            )

            return {
                "subject": subject,
                "object": obj,
                "tense": tense,
                "negation": negation,
                "sentence_type": sentence_type,
                "normalized_verb": verb,
                "adjective": adjective,
                "important_phrases": [],
                "has_explicit_time_word": has_explicit_time,
                "requires_time_marker": verb is not None and verb not in STATE_VERBS,
            }
        except Exception:
            pass

    lower_tokens = [t.lower() for t in analysis.get("tokens", [])]
    if not lower_tokens:
        lower_tokens = [t.lower() for t in re.findall(r"\w+|[^\w\s]", sentence)]

    # 1. Negation
    negation = any(w in lower_tokens for w in ("not", "never", "no", "dont", "cant", "wont"))

    # 2. Sentence type
    sentence_type = "statement"
    for w in lower_tokens:
        if w in WH_WORDS:
            sentence_type = "wh_question"
            break
    if sentence_type == "statement" and lower_tokens:
        if lower_tokens[0] in AUXILIARY_VERBS or sentence.strip().endswith("?"):
            sentence_type = "yes_no_question"

    # 3. Tense
    tense = "PRESENT"
    if any(w in lower_tokens for w in ("was", "were", "did", "had", "yesterday", "last")):
        tense = "PAST"
    elif any(w in lower_tokens for w in ("will", "shall", "going", "tomorrow", "next")):
        tense = "FUTURE"

    # 4. Explicit time word
    has_explicit_time = any(
        w in lower_tokens
        for w in ("yesterday", "today", "tomorrow", "tonight", "now", "later", "soon")
    )

    # 5. Extract Subject, Verb, Object, Adjective
    subject = None
    verb = None
    obj = None
    adjective = None

    pronouns = {"i", "you", "he", "she", "it", "we", "they", "this", "that"}
    filtered_words = [w for w in lower_tokens if w not in ARTICLES and w not in {".", ",", "!", "?"}]

    # Handle possessives: "your name" -> subject: "you", object: "name"
    for i, w in enumerate(filtered_words):
        if w in {"your", "my", "his", "her", "our", "their"} and i + 1 < len(filtered_words):
            subject = "you" if w == "your" else ("i" if w == "my" else w)
            obj = filtered_words[i + 1]
            break

    if not subject:
        for w in filtered_words:
            if w in pronouns:
                subject = w
                break
        if not subject and filtered_words:
            for w in filtered_words:
                if w not in AUXILIARY_VERBS and w not in WH_WORDS:
                    subject = w
                    break

    # Find action verb or adjective
    for w in filtered_words:
        if w not in pronouns and w not in AUXILIARY_VERBS and w not in WH_WORDS and w != subject:
            if w in {"sick", "happy", "tired", "hungry", "fine", "good", "bad"}:
                adjective = w
            elif verb is None and w not in {"school", "apple", "book", "meat", "name", "ball", "friend", "home", "market", "movie"}:
                verb = w
            elif obj is None and w != verb and w != adjective:
                obj = w

    return {
        "subject": subject,
        "object": obj,
        "tense": tense,
        "negation": negation,
        "sentence_type": sentence_type,
        "normalized_verb": verb,
        "adjective": adjective,
        "important_phrases": [],
        "has_explicit_time_word": has_explicit_time,
        "requires_time_marker": verb is not None and verb not in STATE_VERBS,
    }


_PROCESS_TEXT_CACHE: Dict[str, List[Dict[str, Any]]] = {}
_MAX_PROCESS_TEXT_CACHE_SIZE: int = 1000


def process_text(text: str) -> List[Dict[str, Any]]:
    norm_text = re.sub(r"\s+", " ", text.strip().lower())
    if norm_text in _PROCESS_TEXT_CACHE:
        logger.info(f'Process_text cache hit for: "{text}"')
        return [dict(item) for item in _PROCESS_TEXT_CACHE[norm_text]]

    logger.info(f'Processing input: "{text}"')

    sentences = preprocess_text(text)
    if not sentences:
        logger.warning("No sentences found after preprocessing")
        return []

    all_results = []

    for sentence in sentences:
        logger.info(f'Processing sentence: "{sentence}"')

        fixed_result = _check_fixed_expression(sentence)
        if fixed_result:
            logger.info(f"Fixed expression matched: {fixed_result['gloss']}")
            all_results.append(fixed_result)
            continue

        analysis = analyze_text(sentence)

        try:
            llm_data = detect_phrases_llm(sentence, analysis)
        except Exception as e:
            logger.error(f"LLM extraction failed: {e}. Using fallback.")
            llm_data = _fallback_extraction(sentence, analysis)

        transformed = apply_isl_rules(llm_data, analysis["tokens"])
        gloss_output = build_gloss_output(transformed)

        logger.info(f"Final gloss: {gloss_output['gloss']}")
        all_results.append(gloss_output)

    logger.info(f"Processing complete: {len(all_results)} result(s)")

    if all_results:
        if len(_PROCESS_TEXT_CACHE) >= _MAX_PROCESS_TEXT_CACHE_SIZE:
            _PROCESS_TEXT_CACHE.pop(next(iter(_PROCESS_TEXT_CACHE)))
        _PROCESS_TEXT_CACHE[norm_text] = all_results

    return all_results
