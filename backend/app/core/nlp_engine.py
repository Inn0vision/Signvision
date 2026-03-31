import re
import json
import logging
from typing import List, Dict, Any, Optional

import spacy
from openai import OpenAI

from .config import settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger("nlp_engine")

nlp = spacy.load("en_core_web_trf")

llm_client = OpenAI(
    base_url=settings.GPT_BASE_URL,
    api_key=settings.GPT_API_KEY,
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

MAX_LLM_RETRIES = 2


def preprocess_text(text: str) -> List[str]:
    if not text or not text.strip():
        return []

    text = text.lower().strip()

    for contraction, expansion in CONTRACTION_MAP.items():
        text = re.sub(
            r"\b" + re.escape(contraction) + r"\b",
            expansion,
            text,
        )

    raw_sentences = re.split(r"(?<=[.!?])\s*", text)

    sentences = []
    for sentence in raw_sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        sentence = re.sub(r"[^\w\s]", "", sentence)
        sentence = re.sub(r"\s+", " ", sentence).strip()
        if sentence:
            sentences.append(sentence)

    logger.info(f"Preprocessed into {len(sentences)} sentence(s): {sentences}")
    return sentences


def analyze_text(sentence: str) -> Dict[str, List[str]]:
    doc = nlp(sentence)
    tokens = [token.text for token in doc]
    pos_tags = [token.pos_ for token in doc]

    logger.info(f"Linguistic analysis - tokens: {tokens}, POS: {pos_tags}")
    return {"tokens": tokens, "pos": pos_tags}


def _build_llm_prompt(sentence: str, tokens: List[str], pos_tags: List[str]) -> str:
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

1. subject - main subject performing the action
2. object - real-world entity receiving the action, or null
3. tense - PAST / PRESENT / FUTURE
4. negation - true / false
5. sentence_type - statement / yes_no_question / wh_question
6. normalized_verb - base/root verb ONLY
7. adjective - predicative adjective describing the subject (sick, happy, tired, hungry), or null
8. important_phrases - list of phrases with meaning
9. has_explicit_time_word - true / false
10. requires_time_marker - true / false
11. confidence - integer (0-100)

==================== CRITICAL RULES ====================

--- ADJECTIVE RULE ---
- For state sentences like "I am sick", "She is happy", "He feels tired"
- Extract the predicative adjective (sick, happy, tired)
- adjective field captures descriptive states

--- WH-WORD HANDLING ---
- what, where, why, how, who, when
- MUST NOT be object
- MUST NOT appear in "object"

--- OBJECT RULE ---
- Must be real entity (food, school, movie)
- If none -> null

--- VERB RULE ---
- Must be base verb (eat, go, like)
- DON'T skip main verb
- MUST NOT be auxiliary (is, are, am, was, were)

--- AUXILIARY HANDLING ---
- Ignore helping verbs (is, are, etc.)
- Extract ONLY main action verb
- DON'T skip main verb

--- STATE / GREETING ---
Examples: "How are you", "Hello", "I am happy", "I am sick"
- normalized_verb = null
- object = null
- adjective = the state word (happy, sick, tired, hungry, etc.)
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
"going to" -> FUTURE

--- QUESTION TYPE ---
- WH words -> wh_question
- auxiliary start -> yes_no_question

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
-> subject = "you"
-> object = "name"

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
  "adjective": null,
  "important_phrases": [],
  "has_explicit_time_word": false,
  "requires_time_marker": false,
  "confidence": 98
}}

Example 5:
Sentence: "I am sick"
Output:
{{
  "subject": "i",
  "object": null,
  "tense": "PRESENT",
  "negation": false,
  "sentence_type": "statement",
  "normalized_verb": null,
  "adjective": "sick",
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
- Only return when confidence >= 98

==================== OUTPUT FORMAT ====================

Return ONLY valid JSON:

{{
  "subject": "...",
  "object": null,
  "tense": "...",
  "negation": false,
  "sentence_type": "...",
  "normalized_verb": "...",
  "adjective": null,
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
    for attempt in range(1, MAX_LLM_RETRIES + 1):
        logger.info(f"LLM call attempt {attempt}/{MAX_LLM_RETRIES}")

        try:
            completion = llm_client.chat.completions.create(
                model=settings.GPT_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                top_p=0.95,
                max_tokens=1024,
                stream=True,
            )

            response_text = ""
            for chunk in completion:
                if not getattr(chunk, "choices", None):
                    continue
                if chunk.choices and chunk.choices[0].delta.content is not None:
                    response_text += chunk.choices[0].delta.content

            logger.info(f"LLM raw response: {response_text[:300]}...")

            parsed = _parse_llm_json(response_text)

            confidence = parsed.get("confidence", 100)
            if isinstance(confidence, (int, float)) and confidence >= 95:
                logger.info(f"LLM confidence: {confidence}% - accepted")
                return parsed
            else:
                logger.warning(
                    f"LLM confidence {confidence}% < 95% - retrying ({attempt}/{MAX_LLM_RETRIES})"
                )
                prompt += (
                    f"\n\nYour previous response had confidence {confidence}%. "
                    "Please re-analyze more carefully and return a more accurate result "
                    "with confidence >= 95%."
                )

        except Exception as e:
            logger.error(f"LLM call failed on attempt {attempt}: {e}")
            if attempt == MAX_LLM_RETRIES:
                raise ValueError(
                    f"LLM call failed after {MAX_LLM_RETRIES} attempts: {e}"
                )

    logger.warning("Max retries reached - using last LLM response")
    return parsed


def _parse_llm_json(response_text: str) -> Dict[str, Any]:
    text = response_text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    code_block_pattern = r"```(?:json)?\s*\n?(.*?)\n?\s*```"
    match = re.search(code_block_pattern, text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass

    brace_start = text.find("{")
    brace_end = text.rfind("}")
    if brace_start != -1 and brace_end != -1 and brace_end > brace_start:
        try:
            return json.loads(text[brace_start : brace_end + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse valid JSON from LLM response: {text[:200]}")


def detect_phrases_llm(sentence: str, analysis: Dict[str, List[str]]) -> Dict[str, Any]:
    prompt = _build_llm_prompt(sentence, analysis["tokens"], analysis["pos"])
    parsed = call_llm(prompt)

    result = {
        "subject": parsed.get("subject", None),
        "object": parsed.get("object", None),
        "tense": str(parsed.get("tense", "PRESENT")).upper(),
        "negation": bool(parsed.get("negation", False)),
        "sentence_type": parsed.get("sentence_type", "statement"),
        "normalized_verb": parsed.get("normalized_verb", None),
        "adjective": parsed.get("adjective", None),
        "important_phrases": parsed.get("important_phrases", []),
        "has_explicit_time_word": bool(parsed.get("has_explicit_time_word", False)),
        "requires_time_marker": bool(parsed.get("requires_time_marker", False)),
    }

    if result["tense"] not in ("PAST", "PRESENT", "FUTURE"):
        result["tense"] = "PRESENT"

    if result["sentence_type"] not in ("statement", "yes_no_question", "wh_question"):
        result["sentence_type"] = "statement"

    logger.info(f"LLM semantic extraction: {result}")
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
    if not verb and obj and not negation:
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

    lower_tokens = [t.lower() for t in analysis["tokens"]]
    for w in lower_tokens:
        if w in WH_WORDS:
            sentence_type = "wh_question"
            break

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


def process_text(text: str) -> List[Dict[str, Any]]:
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
    return all_results
