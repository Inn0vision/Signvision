# ─────────────────────────────────────────────────────────────
# SignVision — Hybrid NLP Engine for ISL Gloss Generation
# ─────────────────────────────────────────────────────────────
# Pipeline:
#   Input Text → Text Preprocessing → Linguistic Analysis (spaCy)
#   → LLM Semantic Extraction (NVIDIA gpt-oss-120B)
#   → Rule-Based ISL Grammar Transformation
#   → Time Marker Handling → Gloss Structuring → Final JSON
#
# Design Principles:
#   • LLM = semantic meaning extraction ONLY
#   • Rule engine = grammar, reordering, final output
#   • Output is deterministic (same input → same output)
# ─────────────────────────────────────────────────────────────

import re
import json
import logging
from typing import List, Dict, Any, Optional
from pprint import pprint

import spacy
from openai import OpenAI
import os
from dotenv import load_dotenv

# ─────────────────────────────────────────────────────────────
# Logging Configuration
# ─────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger("nlp_engine")

# ─────────────────────────────────────────────────────────────
# Load Models (once at startup)
# ─────────────────────────────────────────────────────────────
nlp = spacy.load("en_core_web_trf")

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
# NVIDIA gpt-oss-120B client (OpenAI-compatible API)
llm_client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=os.getenv("GPT_API_KEY"),
)
LLM_MODEL = "openai/gpt-oss-120b"

# ─────────────────────────────────────────────────────────────
# Constants & Lookup Tables
# ─────────────────────────────────────────────────────────────

# Auxiliary verbs to strip (ISL has no tense markers via verb forms)
AUXILIARY_VERBS = {
    "is", "am", "are", "was", "were",
    "does", "did",
    "have", "has", "had",
    "will", "would", "shall", "should",
    "can", "could", "may", "might", "must",
    "being", "been",
    "going", "gonna",
}

# Articles to remove
ARTICLES = {"a", "an", "the"}

# Determiners to remove
DETERMINERS = {"a", "an", "the", "this", "that", "these", "those"}

# Words indicating state/identity sentences (no time marker needed)
STATE_VERBS = {"be", "feel", "seem", "appear", "look", "sound", "smell", "taste"}

# WH question words
WH_WORDS = {"what", "where", "why", "how", "who", "which", "when", "whom", "whose"}

# Contraction map for pre-processing
CONTRACTION_MAP = {
    "don't": "do not", "dont": "do not",
    "doesn't": "does not", "doesnt": "does not",
    "didn't": "did not", "didnt": "did not",
    "won't": "will not", "wont": "will not",
    "wouldn't": "would not", "wouldnt": "would not",
    "can't": "can not", "cant": "can not",
    "cannot": "can not",
    "couldn't": "could not", "couldnt": "could not",
    "shouldn't": "should not", "shouldnt": "should not",
    "isn't": "is not", "isnt": "is not",
    "aren't": "are not", "arent": "are not",
    "wasn't": "was not", "wasnt": "was not",
    "weren't": "were not", "werent": "were not",
    "haven't": "have not", "havent": "have not",
    "hasn't": "has not", "hasnt": "has not",
    "hadn't": "had not", "hadnt": "had not",
    "mustn't": "must not", "mustnt": "must not",
    "needn't": "need not", "neednt": "need not",
    "i'm": "i am", "im": "i am",
    "you're": "you are", "youre": "you are",
    "he's": "he is", "she's": "she is",
    "it's": "it is", "we're": "we are",
    "they're": "they are", "theyre": "they are",
    "i've": "i have", "ive": "i have",
    "you've": "you have", "youve": "you have",
    "we've": "we have", "weve": "we have",
    "they've": "they have", "theyve": "they have",
    "i'll": "i will", "ill": "i will",
    "you'll": "you will", "youll": "you will",
    "he'll": "he will", "she'll": "she will",
    "we'll": "we will", "they'll": "they will",
    "i'd": "i would", "you'd": "you would",
    "he'd": "he would", "she'd": "she would",
    "we'd": "we would", "they'd": "they would",
}

# Time marker map for tense → ISL time marker
TIME_MARKER_MAP = {
    "PAST": "YESTERDAY",
    "PRESENT": "NOW",
    "FUTURE": "FUTURE",
}

# Fixed expressions that map to single glosses
FIXED_EXPRESSION_MAP = {
    "thank you": "THANKYOU",
    "thank you very much": "THANKYOU",
    "thanks": "THANKYOU",
    "how are you": "HOWAREYOU",
    "how are you doing": "HOWAREYOU",
    "good morning": "GOOD MORNING",
    "good night": "GOOD NIGHT",
    "good evening": "GOOD EVENING",
    "good afternoon": "GOOD AFTERNOON",
}
SORTED_FIXED = sorted(
    FIXED_EXPRESSION_MAP.keys(), key=lambda p: len(p.split()), reverse=True
)

# Maximum LLM retry attempts for confidence validation
MAX_LLM_RETRIES = 2


# ═════════════════════════════════════════════════════════════
# STAGE 1: Text Preprocessing
# ═════════════════════════════════════════════════════════════

def preprocess_text(text: str) -> List[str]:
    """
    Preprocess raw English text into a list of cleaned sentence strings.

    Steps:
      1. Lowercase conversion
      2. Expand contractions (don't → do not)
      3. Sentence splitting (on . ! ?)
      4. Punctuation removal (after splitting to preserve sentence boundaries)
      5. Whitespace normalization

    Parameters
    ----------
    text : str
        Raw English input text.

    Returns
    -------
    List[str]
        List of cleaned, lowercased sentence strings.
    """
    if not text or not text.strip():
        return []

    # Lowercase
    text = text.lower().strip()

    # Expand contractions before sentence splitting
    for contraction, expansion in CONTRACTION_MAP.items():
        # Use word-boundary aware replacement
        text = re.sub(
            r"\b" + re.escape(contraction) + r"\b",
            expansion,
            text,
        )

    # Split into sentences on terminal punctuation
    raw_sentences = re.split(r"(?<=[.!?])\s*", text)

    sentences = []
    for sentence in raw_sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        # Remove all punctuation (keep apostrophes for edge cases, letters, digits, spaces)
        sentence = re.sub(r"[^\w\s]", "", sentence)
        # Normalize whitespace
        sentence = re.sub(r"\s+", " ", sentence).strip()
        if sentence:
            sentences.append(sentence)

    logger.info(f"Preprocessed into {len(sentences)} sentence(s): {sentences}")
    return sentences


# ═════════════════════════════════════════════════════════════
# STAGE 2: Linguistic Analysis (spaCy)
# ═════════════════════════════════════════════════════════════

def analyze_text(sentence: str) -> Dict[str, List[str]]:
    """
    Perform linguistic analysis on a sentence using spaCy.

    Parameters
    ----------
    sentence : str
        A single preprocessed sentence string.

    Returns
    -------
    dict
        {
            "tokens": ["i", "am", "not", "going", ...],
            "pos":    ["PRON", "AUX", "PART", "VERB", ...]
        }
    """
    doc = nlp(sentence)
    tokens = [token.text for token in doc]
    pos_tags = [token.pos_ for token in doc]

    logger.info(f"Linguistic analysis — tokens: {tokens}, POS: {pos_tags}")
    return {"tokens": tokens, "pos": pos_tags}


# ═════════════════════════════════════════════════════════════
# STAGE 3: LLM Integration (NVIDIA gpt-oss-120B)
# ═════════════════════════════════════════════════════════════

# true/false, true if the sentence describes an action that needs a time reference, false for state/identity/greeting sentences

def _build_llm_prompt(sentence: str, tokens: List[str], pos_tags: List[str]) -> str:
    """
    Structured prompt with CONTEXT + INSTRUCTIONS + RULES + EXAMPLES
    for high-accuracy semantic extraction.
    """
    prompt = f"""
==================== CONTEXT ====================

You are an expert NLP semantic extraction engine for an Indian Sign Language (ISL) system.

Your role is ONLY to extract structured meaning from English sentences.
You are NOT allowed to generate ISL gloss.

The output will be used by a rule-based engine that strictly depends on your accuracy.

==================== INPUT ====================

Sentence: "{sentence}"
Tokens: {tokens}
POS Tags: {pos_tags}

==================== INSTRUCTIONS ====================

Extract the following fields:

1. subject — main subject performing the action
2. object — real-world entity receiving the action, or null
3. tense — PAST / PRESENT / FUTURE
4. negation — true / false
5. sentence_type — statement / yes_no_question / wh_question
6. normalized_verb — base/root verb ONLY
7. important_phrases — list of phrases with meaning
8. has_explicit_time_word — true / false
9. requires_time_marker — true / false
10. confidence — integer (0–100)

==================== CRITICAL RULES ====================

--- WH-WORD HANDLING ---
- what, where, why, how, who, when
- MUST NOT be object
- MUST NOT appear in "object"

--- OBJECT RULE ---
- Must be real entity (food, school, movie)
- If none → null

--- VERB RULE ---
- Must be base verb (eat, go, like)
- DON'T skip main verb
- MUST NOT be auxiliary (is, are, am, was, were)

--- AUXILIARY HANDLING ---
- Ignore helping verbs (is, are, etc.)
- Extract ONLY main action verb
- DON'T skip main verb

--- STATE / GREETING ---
Examples: "How are you", "Hello", "I am happy"
- normalized_verb = null
- object = null
- requires_time_marker = false

--- ACTION SENTENCES ---
Examples: eat, go, play, like
- requires_time_marker = true

--- CONTINUOUS QUESTIONS ---
Example: "What are you doing"
- normalized_verb = "do"
- requires_time_marker = false

--- SPECIAL CASE ---
"What do you like"
- subject = "you"
- object = null
- normalized_verb = "like"

--- FUTURE DETECTION ---
"going to" → FUTURE

--- QUESTION TYPE ---
- WH words → wh_question
- auxiliary start → yes_no_question

--- POSSESSIVE STRUCTURE RULE  ---

For phrases like:
- "your name"
- "my book"
- "his car"

DO NOT combine into one subject.

Instead:
- subject = "you" (from "your")
- object = "name"

Example:
"What is your name"
→ subject = "you"
→ object = "name"

--- IDENTITY SENTENCE RULE  ---

For sentences like:
- "This is Sakshi"
- "He is a teacher"
- "She is my friend"

Treat them as identity statements.

Rules:
- subject = first entity (this / he / she)
- object = identity/complement (Sakshi / teacher / friend)
- normalized_verb = null
- requires_time_marker = false

==================== EXAMPLES ====================

Example 1:
Sentence: "What are you doing"
Output:
{{
  "subject": "you",
  "object": null,
  "tense": "PRESENT",
  "negation": false,
  "sentence_type": "wh_question",
  "normalized_verb": "do",
  "important_phrases": [],
  "has_explicit_time_word": false,
  "requires_time_marker": false,
  "confidence": 98
}}

Example 2:
Sentence: "What do you like"
Output:
{{
  "subject": "you",
  "object": null,
  "tense": "PRESENT",
  "negation": false,
  "sentence_type": "wh_question",
  "normalized_verb": "like",
  "important_phrases": [],
  "has_explicit_time_word": false,
  "requires_time_marker": false,
  "confidence": 98
}}

Example 3:
Sentence: "I am not going to school"
Output:
{{
  "subject": "i",
  "object": "school",
  "tense": "FUTURE",
  "negation": true,
  "sentence_type": "statement",
  "normalized_verb": "go",
  "important_phrases": [
    {{
      "phrase": "going to",
      "meaning": "future intention"
    }}
  ],
  "has_explicit_time_word": false,
  "requires_time_marker": true,
  "confidence": 98
}}

Example 4:
Sentence: "How are you"
Output:
{{
  "subject": "you",
  "object": null,
  "tense": "PRESENT",
  "negation": false,
  "sentence_type": "wh_question",
  "normalized_verb": null,
  "important_phrases": [],
  "has_explicit_time_word": false,
  "requires_time_marker": false,
  "confidence": 98
}}

==================== SELF-VALIDATION ====================

Before returning:

- Ensure object is NOT a WH-word
- Ensure verb is NOT auxiliary
- Ensure rules are followed
- Ensure structure is correct

If confidence < 98:
- Re-analyze internally
- Fix errors
- Only return when confidence ≥ 98

==================== OUTPUT FORMAT ====================

Return ONLY valid JSON:

{{
  "subject": "...",
  "object": null,
  "tense": "...",
  "negation": false,
  "sentence_type": "...",
  "normalized_verb": "...",
  "important_phrases": [],
  "has_explicit_time_word": false,
  "requires_time_marker": false,
  "confidence": 98
}}

NO explanation. NO extra text.

========================================================
"""
    return prompt
def call_llm(prompt: str) -> Dict[str, Any]:
    """
    Call the NVIDIA gpt-oss-120B model via OpenAI-compatible API.

    Sends the prompt, collects the streamed response, and parses the JSON.
    Includes retry logic if confidence is below 95%.

    Parameters
    ----------
    prompt : str
        The structured prompt for semantic extraction.

    Returns
    -------
    dict
        Parsed JSON response from the LLM.

    Raises
    ------
    ValueError
        If JSON parsing fails after retries.
    """
    for attempt in range(1, MAX_LLM_RETRIES + 1):
        logger.info(f"LLM call attempt {attempt}/{MAX_LLM_RETRIES}")

        try:
            # Stream the response from the LLM
            completion = llm_client.chat.completions.create(
                model=LLM_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,  # Low temperature for deterministic output
                top_p=0.95,
                max_tokens=1024,
                stream=True,
            )

            # Collect the full response text (skip reasoning tokens)
            response_text = ""
            for chunk in completion:
                if not getattr(chunk, "choices", None):
                    continue
                if chunk.choices and chunk.choices[0].delta.content is not None:
                    response_text += chunk.choices[0].delta.content

            logger.info(f"LLM raw response: {response_text[:300]}...")

            # Parse JSON from the response
            parsed = _parse_llm_json(response_text)

            # Validate confidence — re-prompt if below 95%
            confidence = parsed.get("confidence", 100)
            if isinstance(confidence, (int, float)) and confidence >= 95:
                logger.info(f"LLM confidence: {confidence}% — accepted")
                return parsed
            else:
                logger.warning(
                    f"LLM confidence {confidence}% < 95% — retrying ({attempt}/{MAX_LLM_RETRIES})"
                )
                # Append retry instruction to prompt
                prompt += (
                    f"\n\nYour previous response had confidence {confidence}%. "
                    "Please re-analyze more carefully and return a more accurate result "
                    "with confidence >= 95%."
                )

        except Exception as e:
            logger.error(f"LLM call failed on attempt {attempt}: {e}")
            if attempt == MAX_LLM_RETRIES:
                raise ValueError(f"LLM call failed after {MAX_LLM_RETRIES} attempts: {e}")

    # If all retries exhausted, return the last parsed result anyway
    logger.warning("Max retries reached — using last LLM response")
    return parsed


def _parse_llm_json(response_text: str) -> Dict[str, Any]:
    """
    Safely parse JSON from LLM response text.

    Handles cases where the LLM wraps JSON in markdown code blocks
    or includes extra text around the JSON.

    Parameters
    ----------
    response_text : str
        Raw text response from the LLM.

    Returns
    -------
    dict
        Parsed JSON dictionary.

    Raises
    ------
    ValueError
        If no valid JSON can be extracted.
    """
    text = response_text.strip()

    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Remove markdown code block wrappers
    code_block_pattern = r"```(?:json)?\s*\n?(.*?)\n?\s*```"
    match = re.search(code_block_pattern, text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass

    # Try to find JSON object in the text
    brace_start = text.find("{")
    brace_end = text.rfind("}")
    if brace_start != -1 and brace_end != -1 and brace_end > brace_start:
        try:
            return json.loads(text[brace_start : brace_end + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse valid JSON from LLM response: {text[:200]}")


# ═════════════════════════════════════════════════════════════
# STAGE 4: LLM-based Phrase Detection / Semantic Extraction
# ═════════════════════════════════════════════════════════════

def detect_phrases_llm(sentence: str, analysis: Dict[str, List[str]]) -> Dict[str, Any]:
    """
    Use the LLM to extract semantic structure from a sentence.

    Combines linguistic analysis (tokens + POS) with LLM semantic understanding
    to extract subject, object, verb, tense, negation, question type, and phrases.

    Parameters
    ----------
    sentence : str
        The preprocessed sentence string.
    analysis : dict
        Output from analyze_text() containing tokens and POS tags.

    Returns
    -------
    dict
        Structured semantic data from the LLM:
        {
            "subject", "object", "tense", "negation", "sentence_type",
            "normalized_verb", "important_phrases",
            "has_explicit_time_word", "requires_time_marker"
        }
    """
    prompt = _build_llm_prompt(sentence, analysis["tokens"], analysis["pos"])
    parsed = call_llm(prompt)

    # Normalize and validate the parsed output
    result = {
        "subject": parsed.get("subject", None),
        "object": parsed.get("object", None),
        "tense": str(parsed.get("tense", "PRESENT")).upper(),
        "negation": bool(parsed.get("negation", False)),
        "sentence_type": parsed.get("sentence_type", "statement"),
        "normalized_verb": parsed.get("normalized_verb", None),
        "important_phrases": parsed.get("important_phrases", []),
        "has_explicit_time_word": bool(parsed.get("has_explicit_time_word", False)),
        "requires_time_marker": bool(parsed.get("requires_time_marker", False)),
    }

    # Validate tense is one of the expected values
    if result["tense"] not in ("PAST", "PRESENT", "FUTURE"):
        result["tense"] = "PRESENT"

    # Validate sentence_type
    if result["sentence_type"] not in ("statement", "yes_no_question", "wh_question"):
        result["sentence_type"] = "statement"

    logger.info(f"LLM semantic extraction: {result}")
    return result


# ═════════════════════════════════════════════════════════════
# STAGE 5: Rule-Based ISL Transformation (CORE)
# ═════════════════════════════════════════════════════════════

def apply_isl_rules(parsed_data: Dict[str, Any], tokens: List[str]) -> Dict[str, Any]:
    """
    Apply Indian Sign Language grammar rules to transform the parsed data.

    ISL Grammar Rules Applied:
      • Remove auxiliary verbs (is, am, are, was, were, do, does, did, etc.)
      • Remove helping verbs
      • Remove articles (a, an, the)
      • Use normalized_verb from LLM (base form)
      • Add negation marker "NOT" at end if negation is true
      • Move question words (who, what, why, etc.) to end for WH-questions

    Parameters
    ----------
    parsed_data : dict
        Output from detect_phrases_llm().
    tokens : list
        Original token list from the sentence.

    Returns
    -------
    dict
        Transformed data ready for gloss structuring:
        {
            "subject", "object", "verb", "tense", "negation", "question",
            "question_word", "time_marker", "is_state_sentence"
        }
    """
    subject = parsed_data.get("subject")
    obj = parsed_data.get("object")
    verb = parsed_data.get("normalized_verb")
    tense = parsed_data.get("tense", "PRESENT")
    negation = parsed_data.get("negation", False)
    sentence_type = parsed_data.get("sentence_type", "statement")
    has_explicit_time = parsed_data.get("has_explicit_time_word", False)
    requires_time = parsed_data.get("requires_time_marker", False)

    # --- Clean subject: remove articles and auxiliaries ---
    if subject:
        subject_words = subject.lower().split()
        subject_words = [
            w for w in subject_words
            if w not in ARTICLES and w not in AUXILIARY_VERBS
        ]
        subject = " ".join(subject_words) if subject_words else None

    # --- Clean object: remove articles and auxiliaries ---
    if obj:
        if isinstance(obj, list):
            # Handle list of objects
            cleaned_objects = []
            for o in obj:
                obj_words = str(o).lower().split()
                obj_words = [
                    w for w in obj_words
                    if w not in ARTICLES and w not in AUXILIARY_VERBS
                ]
                if obj_words:
                    cleaned_objects.append(" ".join(obj_words))
            obj = " ".join(cleaned_objects) if cleaned_objects else None
        else:
            obj_words = str(obj).lower().split()
            obj_words = [
                w for w in obj_words
                if w not in ARTICLES and w not in AUXILIARY_VERBS
            ]
            obj = " ".join(obj_words) if obj_words else None

    # --- Normalize verb to base form ---
    if verb:
        verb = verb.lower().strip()
        # Remove any auxiliary that leaked into the verb
        if verb in AUXILIARY_VERBS:
            verb = None

    # --- Detect if this is a state/identity sentence ---
    is_state_sentence = False
    if verb and verb in STATE_VERBS:
        is_state_sentence = True
    # "I am happy" — verb might be None, object is an adjective
    if not verb and obj and not negation:
        # Check if original tokens suggest a state sentence
        lower_tokens = [t.lower() for t in tokens]
        if any(aux in lower_tokens for aux in ("am", "is", "are", "was", "were")):
            is_state_sentence = True

    # --- Determine question word ---
    question_word = None
    is_question = False
    if sentence_type == "wh_question":
        is_question = True
        # Extract the WH word from tokens
        lower_tokens = [t.lower() for t in tokens]
        for w in lower_tokens:
            if w in WH_WORDS:
                question_word = w
                break
    elif sentence_type == "yes_no_question":
        is_question = True

    # --- Time marker logic ---
    time_marker = None
    if requires_time and not has_explicit_time and not is_state_sentence:
        time_marker = TIME_MARKER_MAP.get(tense)

    # --- Extract explicit time words from tokens ---
    explicit_time_words = []
    if has_explicit_time:
        temporal_keywords = {
            "yesterday", "today", "tomorrow", "tonight", "morning",
            "afternoon", "evening", "night", "now", "later", "soon",
        }
        temporal_modifiers = {"last", "next", "this", "every"}
        lower_tokens = [t.lower() for t in tokens]
        i = 0
        while i < len(lower_tokens):
            # Check for modifier + keyword bigram
            if (lower_tokens[i] in temporal_modifiers
                    and i + 1 < len(lower_tokens)
                    and lower_tokens[i + 1] in temporal_keywords):
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


# ═════════════════════════════════════════════════════════════
# STAGE 6 & 7: Gloss Structuring (Final Output)
# ═════════════════════════════════════════════════════════════

def build_gloss_output(transformed: Dict[str, Any]) -> Dict[str, Any]:
    """
    Build the final ISL gloss output following ISL grammar rules.

    ISL Gloss Order:
      [TIME_MARKER] + [SUBJECT] + [OBJECT] + [VERB] + [NEGATION] + [QUESTION_WORD]

    Rules applied:
      • All gloss tokens are UPPERCASE
      • Time markers at the very start
      • Object-Subject-Verb (OSV) ordering
      • Question words (Who, What, Why) at the end
      • Negation "NOT" at the end (before question word if both present)
      • Base/root form of verbs only

    Parameters
    ----------
    transformed : dict
        Output from apply_isl_rules().

    Returns
    -------
    dict
        Final structured output:
        {
            "subject": str,
            "object": str (UPPERCASE),
            "verb": str (UPPERCASE),
            "tense": str,
            "negation": bool,
            "question": bool,
            "gloss": List[str]
        }
    """
    gloss_tokens = []

    subject = transformed.get("subject")
    obj = transformed.get("object")
    verb = transformed.get("verb")
    tense = transformed.get("tense", "PRESENT")
    negation = transformed.get("negation", False)
    is_question = transformed.get("question", False)
    question_word = transformed.get("question_word")
    time_marker = transformed.get("time_marker")
    explicit_time_words = transformed.get("explicit_time_words", [])

    # 1. Time markers / explicit time at the very start
    if explicit_time_words:
        for tw in explicit_time_words:
            gloss_tokens.append(tw.upper())
    elif time_marker:
        gloss_tokens.append(time_marker.upper())

    # 2. Subject
    if subject:
        gloss_tokens.append(subject.upper())

    # 3. Object (before verb in ISL)
    if obj:
        gloss_tokens.append(obj.upper())

    # 4. Verb (base form, uppercase)
    if verb:
        gloss_tokens.append(verb.upper())

    # 5. Negation marker at end
    if negation:
        gloss_tokens.append("NOT")

    # 6. Question word at end (ISL places WH-words at end)
    if question_word:
        gloss_tokens.append(question_word.upper())

    # 7. Yes/No question marker
    if is_question and not question_word:
        gloss_tokens.append("Q")

    # Build the final output
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


# ═════════════════════════════════════════════════════════════
# FIXED EXPRESSION HANDLER
# ═════════════════════════════════════════════════════════════

def _check_fixed_expression(sentence: str) -> Optional[Dict[str, Any]]:
    """
    Check if the sentence matches a known fixed expression.

    Returns a complete gloss output dict if matched, None otherwise.
    """
    lower = sentence.lower().strip()
    # Remove punctuation for comparison
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


# ═════════════════════════════════════════════════════════════
# PUBLIC API: process_text
# ═════════════════════════════════════════════════════════════

def process_text(text: str) -> List[Dict[str, Any]]:
    """
    End-to-end pipeline: raw English text → structured ISL gloss output.

    Pipeline stages:
      1. Text Preprocessing (lowercase, split, clean)
      2. For each sentence:
         a. Check for fixed expressions
         b. Linguistic Analysis (spaCy POS tagging)
         c. LLM Semantic Extraction (NVIDIA gpt-oss-120B)
         d. Rule-Based ISL Transformation
         e. Gloss Structuring

    Parameters
    ----------
    text : str
        Raw English input text (from speech-to-text or direct input).

    Returns
    -------
    List[dict]
        List of gloss output dicts, one per sentence. Each dict:
        {
            "subject": str or None,
            "object": str or None (UPPERCASE),
            "verb": str or None (UPPERCASE),
            "tense": "PAST" | "PRESENT" | "FUTURE",
            "negation": bool,
            "question": bool,
            "gloss": List[str]  (all UPPERCASE tokens)
        }
    """
    logger.info(f"═══ Processing input: \"{text}\" ═══")

    # Stage 1: Preprocessing
    sentences = preprocess_text(text)
    if not sentences:
        logger.warning("No sentences found after preprocessing")
        return []

    all_results = []

    for sentence in sentences:
        logger.info(f"── Processing sentence: \"{sentence}\" ──")

        # Check for fixed expressions first (skip LLM for these)
        fixed_result = _check_fixed_expression(sentence)
        if fixed_result:
            logger.info(f"Fixed expression matched: {fixed_result['gloss']}")
            all_results.append(fixed_result)
            continue

        # Stage 2: Linguistic Analysis (spaCy)
        analysis = analyze_text(sentence)

        # Stage 3 & 4: LLM Semantic Extraction
        try:
            llm_data = detect_phrases_llm(sentence, analysis)
        except Exception as e:
            logger.error(f"LLM extraction failed: {e}. Using fallback.")
            # Fallback: use basic spaCy-only extraction
            llm_data = _fallback_extraction(sentence, analysis)

        # Stage 5: Rule-Based ISL Transformation
        transformed = apply_isl_rules(llm_data, analysis["tokens"])

        # Stage 6 & 7: Gloss Structuring
        gloss_output = build_gloss_output(transformed)

        logger.info(f"Final gloss: {gloss_output['gloss']}")
        all_results.append(gloss_output)

    logger.info(f"═══ Processing complete: {len(all_results)} result(s) ═══")
    return all_results


# ═════════════════════════════════════════════════════════════
# FALLBACK: spaCy-only extraction (when LLM is unavailable)
# ═════════════════════════════════════════════════════════════

def _fallback_extraction(sentence: str, analysis: Dict) -> Dict[str, Any]:
    """
    Basic rule-based extraction using spaCy when the LLM is unavailable.
    This provides a degraded but functional fallback.
    """
    doc = nlp(sentence)

    subject = None
    obj = None
    verb = None
    negation = False
    sentence_type = "statement"

    for token in doc:
        if token.dep_ in ("nsubj", "nsubjpass") and not subject:
            subject = token.text.lower()
        elif token.dep_ == "ROOT" and token.pos_ in ("VERB", "AUX"):
            if token.lower_ not in AUXILIARY_VERBS:
                verb = token.lemma_.lower()
        elif token.dep_ in ("dobj", "pobj", "attr"):
            if token.lower_ not in ARTICLES and token.lower_ not in AUXILIARY_VERBS:
                obj = token.lemma_.lower()
        elif token.dep_ == "neg":
            negation = True
        elif token.dep_ == "xcomp" and token.pos_ == "VERB":
            if not verb:
                verb = token.lemma_.lower()

    # Detect question type
    lower_tokens = [t.lower() for t in analysis["tokens"]]
    for w in lower_tokens:
        if w in WH_WORDS:
            sentence_type = "wh_question"
            break

    # Detect tense from auxiliaries
    tense = "PRESENT"
    if any(w in lower_tokens for w in ("was", "were", "did")):
        tense = "PAST"
    elif any(w in lower_tokens for w in ("will", "shall", "going")):
        tense = "FUTURE"

    has_explicit_time = any(
        w in lower_tokens
        for w in ("yesterday", "today", "tomorrow", "tonight", "now", "later")
    )

    return {
        "subject": subject,
        "object": obj,
        "tense": tense,
        "negation": negation,
        "sentence_type": sentence_type,
        "normalized_verb": verb,
        "important_phrases": [],
        "has_explicit_time_word": has_explicit_time,
        "requires_time_marker": verb is not None and verb not in STATE_VERBS,
    }


# ═════════════════════════════════════════════════════════════
# TEST RUNNER
# ═════════════════════════════════════════════════════════════

TEST_SENTENCES = [
    # Fixed expressions
    ("Fixed Expression",  "Thank you"),
    ("Fixed Expression",  "How are you"),

    # Core test case from requirements
    ("Statement + Neg",   "I am not going to school"),

    # Statements
    ("Statement",         "I am going to school"),
    ("Statement",         "She is eating food"),
    ("Statement",         "They are playing cricket"),
    ("Statement",         "He was playing cricket"),
    ("Statement",         "I have completed my homework"),

    # Negation
    ("Negation",          "I don't know"),
    ("Negation",          "She cannot come tomorrow"),
    ("Negation",          "He didn't go to school"),
    ("Negation",          "I am not feeling well"),

    # WH-questions
    ("WH-Question",       "What is your name"),
    ("WH-Question",       "Where do you live"),
    ("WH-Question",       "Why are you crying"),

    # YES/NO questions
    ("YES/NO Question",   "Are you hungry"),
    ("YES/NO Question",   "Can you help me"),

    # Time phrases
    ("Time",              "I did not eat an apple yesterday"),
    ("Time",              "She will go to the market tomorrow"),
    ("Time",              "Last night I watched a movie"),
]


def run_tests():
    """Run all test sentences through the hybrid NLP pipeline and print results."""
    print("\n" + "=" * 70)
    print("  SignVision — HYBRID NLP ENGINE — TEST RUN")
    print("=" * 70)

    passed = 0
    failed = 0

    for category, sentence in TEST_SENTENCES:
        print(f"\n{'─' * 70}")
        print(f"[{category}] INPUT: \"{sentence}\"")
        print(f"{'─' * 70}")
        try:
            results = process_text(sentence)
            for r in results:
                pprint(f"  GLOSS    : {' '.join(r['gloss'])}")
                pprint(f"  SUBJECT  : {r.get('subject')}")
                pprint(f"  OBJECT   : {r.get('object')}")
                pprint(f"  VERB     : {r.get('verb')}")
                pprint(f"  TENSE    : {r.get('tense')}")
                pprint(f"  NEGATION : {r.get('negation', False)}")
                pprint(f"  QUESTION : {r.get('question', False)}")
            passed += 1
        except Exception as e:
            pprint(f"  ✗ ERROR: {e}")
            import traceback
            traceback.print_exc()
            failed += 1

    # Summary
    pprint("\n" + "=" * 70)
    pprint(f"  SUMMARY: Passed={passed} | Failed={failed} | Total={passed + failed}")
    pprint("=" * 70)

    # Detailed table
    pprint(f"\n{'CATEGORY':<20} {'INPUT':<45} {'GLOSS'}")
    pprint("─" * 100)
    for category, sentence in TEST_SENTENCES:
        try:
            results = process_text(sentence)
            for r in results:
                gloss = " ".join(r["gloss"])
                pprint(f"{category:<20} {sentence:<45} {gloss}")
        except Exception as e:
            pprint(f"{category:<20} {sentence:<45} ERROR: {e}")
    pprint("=" * 100)


if __name__ == "__main__":
    run_tests()
