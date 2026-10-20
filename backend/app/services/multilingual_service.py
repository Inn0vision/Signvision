import re
import logging
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass

from ..core.config import settings

logger = logging.getLogger("multilingual_service")

# Regex to detect Devanagari script Unicode block (U+0900 to U+097F)
DEVANAGARI_PATTERN = re.compile(r"[\u0900-\u097F]")

# Characteristic Marathi tokens in Devanagari
MARATHI_DEVANAGARI_MARKERS = {
    "आहे", "आहोत", "आहेत", "नाही", "केले", "केला", "केली", "झाले", "झाला",
    "तुम्ही", "आम्ही", "आपण", "जेवण", "का", "कसे", "कशी", "कुठे", "कधी",
    "सफरचंद", "भाऊ", "बहीण", "मुलगा", "मुलगी", "शाळा", "घर", "पाऊस"
}

# Characteristic Hindi tokens in Devanagari
HINDI_DEVANAGARI_MARKERS = {
    "है", "हैं", "हो", "हूँ", "था", "थी", "थे", "रहा", "रही", "रहे",
    "क्या", "कहाँ", "कैसे", "कैसी", "क्यों", "कब", "खाना", "खाया", "खाई",
    "गया", "गयी", "गए", "आप", "तुम", "हम", "मैं", "नहीं", "सेब"
}

# Romanized Hindi & Marathi vocabulary / grammatical markers
ROMANIZED_INDIC_TOKENS = {
    # Hindi question & auxiliary words
    "kya", "kyun", "kyu", "kaise", "kahan", "kab", "kisko", "kiske",
    "hai", "hain", "ho", "hu", "hoon", "tha", "thi",
    "raha", "rahi", "rahe", "gaya", "gayi", "gaye", "aaya", "aayi", "aaye",
    "kar", "karna", "karo", "kare", "karenge", "karta", "karti",
    # Hindi pronouns & possessives
    "aap", "aapne", "aapka", "aapki", "aapke", "apne", "tum", "tumne", "tumhara",
    "tumhari", "hum", "humne", "hamara", "mai", "mera", "meri", "mere",
    "mujhe", "usne", "unhone", "iska", "uska",
    # Hindi vocabulary
    "khana", "khaya", "khayi", "khaye", "khya", "kha", "seb", "paani", "pani", "ghar",
    "naam", "thik", "theek", "shukriya", "dhanyawad", "dhanyavad", "namaste", "chalo", "jao",
    # Marathi question & auxiliary words
    "ka", "kase", "kasa", "kashi", "kuthe", "kadhi",
    "ahe", "ahat", "ahes", "ahot", "ahet", "nahi", "nahit",
    "kela", "kele", "keli", "zhala", "zhale", "zhali", "gela", "geli", "gele",
    # Marathi pronouns & possessives
    "tumhi", "amhi", "apan", "majhe", "tujhe", "tyanche", "tiche", "mala", "tula",
    # Marathi vocabulary
    "jevan", "jeven", "jevla", "jevli", "bhaau", "bahin", "mulga", "mulgi",
    "shala", "paaus", "aabhar", "namaskar",
}

MARATHI_ROMANIZED_MARKERS = {
    "ka", "kase", "kasa", "kashi", "kuthe", "kadhi", "ahe", "ahat", "ahes",
    "ahot", "ahet", "nahi", "kela", "kele", "keli", "zhala", "zhale", "zhali",
    "tumhi", "amhi", "apan", "majhe", "tujhe", "mala", "tula", "jevan", "jeven",
    "jevla", "jevli", "shala", "aabhar", "namaskar",
}

# English fixed expressions that require no translation
FIXED_ENGLISH_EXPRESSIONS = {
    "thank you", "thank you very much", "thanks", "how are you",
    "how are you doing", "good morning", "good night", "good evening",
    "good afternoon", "hello", "hi", "bye", "goodbye", "welcome"
}

# Common offline deterministic translations for fast path & offline fallback
OFFLINE_TRANSLATIONS: Dict[str, Tuple[str, str]] = {
    # Hindi romanized
    "kya aapne khana khaya": ("Have you eaten food?", "hi-Latn"),
    "kya aapne khana khaya?": ("Have you eaten food?", "hi-Latn"),
    "kya apne khana khya": ("Have you eaten food?", "hi-Latn"),
    "kya apne khana khya?": ("Have you eaten food?", "hi-Latn"),
    "kya aap khana khaye": ("Have you eaten food?", "hi-Latn"),
    "kya khana khaya": ("Have you eaten food?", "hi-Latn"),
    "aapne khana khaya": ("Have you eaten food?", "hi-Latn"),
    "tumne khana khaya": ("Have you eaten food?", "hi-Latn"),
    "kya tumne khana khaya": ("Have you eaten food?", "hi-Latn"),
    "aap kaise ho": ("How are you?", "hi-Latn"),
    "aap kaise ho?": ("How are you?", "hi-Latn"),
    "tum kaise ho": ("How are you?", "hi-Latn"),
    "tum kaise ho?": ("How are you?", "hi-Latn"),
    "kya hal hai": ("How are you?", "hi-Latn"),
    "mai thik hu": ("I am fine", "hi-Latn"),
    "main theek hoon": ("I am fine", "hi-Latn"),
    "mera naam rahul hai": ("My name is Rahul", "hi-Latn"),
    "namaste": ("Hello", "hi-Latn"),
    "dhanyawad": ("Thank you", "hi-Latn"),
    "dhanyavad": ("Thank you", "hi-Latn"),
    "shukriya": ("Thank you", "hi-Latn"),

    # Marathi romanized
    "jeven kela ka": ("Have you eaten food?", "mr-Latn"),
    "jeven kela ka?": ("Have you eaten food?", "mr-Latn"),
    "jevan kela ka": ("Have you eaten food?", "mr-Latn"),
    "jevan kela ka?": ("Have you eaten food?", "mr-Latn"),
    "tumhi jevan kela ka": ("Have you eaten food?", "mr-Latn"),
    "tumhi jevan kela ka?": ("Have you eaten food?", "mr-Latn"),
    "tumhi jevan kele ka": ("Have you eaten food?", "mr-Latn"),
    "tumhi jevan kele ka?": ("Have you eaten food?", "mr-Latn"),
    "jevla ka": ("Have you eaten food?", "mr-Latn"),
    "jevla ka?": ("Have you eaten food?", "mr-Latn"),
    "jevli ka": ("Have you eaten food?", "mr-Latn"),
    "jevli ka?": ("Have you eaten food?", "mr-Latn"),
    "kasa ahes": ("How are you?", "mr-Latn"),
    "kasa ahes?": ("How are you?", "mr-Latn"),
    "kashi ahes": ("How are you?", "mr-Latn"),
    "kashi ahes?": ("How are you?", "mr-Latn"),
    "tumhi kase ahat": ("How are you?", "mr-Latn"),
    "tumhi kase ahat?": ("How are you?", "mr-Latn"),
    "mi thik ahe": ("I am fine", "mr-Latn"),
    "majhe naav rahul ahe": ("My name is Rahul", "mr-Latn"),
    "namaskar": ("Hello", "mr-Latn"),
    "aabhar": ("Thank you", "mr-Latn"),

    # Hindi Devanagari
    "आपका नाम क्या है": ("What is your name?", "hi"),
    "आपका नाम क्या है?": ("What is your name?", "hi"),
    "तुम्हारा नाम क्या है": ("What is your name?", "hi"),
    "तुम्हारा नाम क्या है?": ("What is your name?", "hi"),
    "तेरा नाम क्या है": ("What is your name?", "hi"),
    "तेरा नाम क्या है?": ("What is your name?", "hi"),
    "मेरा नाम": ("My name", "hi"),
    "आप कहाँ जा रहे हैं": ("Where are you going?", "hi"),
    "आप कहाँ जा रहे हैं?": ("Where are you going?", "hi"),
    "मुझे मदद चाहिए": ("I need help", "hi"),
    "मुझे मदद चाहिए।": ("I need help", "hi"),
    "क्या आपने खाना खाया": ("Have you eaten food?", "hi"),
    "क्या आपने खाना खाया?": ("Have you eaten food?", "hi"),
    "क्या तुमने खाना खाया": ("Have you eaten food?", "hi"),
    "क्या तुमने खाना खाया?": ("Have you eaten food?", "hi"),
    "आप कैसे हैं": ("How are you?", "hi"),
    "आप कैसे हैं?": ("How are you?", "hi"),
    "तुम कैसे हो": ("How are you?", "hi"),
    "तुम कैसे हो?": ("How are you?", "hi"),
    "नमस्ते": ("Hello", "hi"),
    "धन्यवाद": ("Thank you", "hi"),
    "शुक्रिया": ("Thank you", "hi"),
    "मैं ठीक हूँ": ("I am fine", "hi"),

    # Marathi Devanagari
    "तुमचं नाव काय आहे": ("What is your name?", "mr"),
    "तुमचं नाव काय आहे?": ("What is your name?", "mr"),
    "तुमचे नाव काय आहे": ("What is your name?", "mr"),
    "तुमचे नाव काय आहे?": ("What is your name?", "mr"),
    "तुझे नाव काय आहे": ("What is your name?", "mr"),
    "तुझे नाव काय आहे?": ("What is your name?", "mr"),
    "माझे नाव": ("My name", "mr"),
    "माझं नाव": ("My name", "mr"),
    "तुम्ही कुठे जात आहात": ("Where are you going?", "mr"),
    "तुम्ही कुठे जात आहात?": ("Where are you going?", "mr"),
    "मला मदत हवी आहे": ("I need help", "mr"),
    "मला मदत हवी आहे.": ("I need help", "mr"),
    "तुम्ही जेवण केले का": ("Have you eaten food?", "mr"),
    "तुम्ही जेवण केले का?": ("Have you eaten food?", "mr"),
    "तुम्ही जेवण केला का": ("Have you eaten food?", "mr"),
    "तुम्ही जेवण केला का?": ("Have you eaten food?", "mr"),
    "जेवण झाले का": ("Have you eaten food?", "mr"),
    "जेवण झाले का?": ("Have you eaten food?", "mr"),
    "जेवला का": ("Have you eaten food?", "mr"),
    "जेवला का?": ("Have you eaten food?", "mr"),
    "जेवली का": ("Have you eaten food?", "mr"),
    "जेवली का?": ("Have you eaten food?", "mr"),
    "तुम्ही कसे आहात": ("How are you?", "mr"),
    "तुम्ही कसे आहात?": ("How are you?", "mr"),
    "कसा आहेस": ("How are you?", "mr"),
    "कसा आहेस?": ("How are you?", "mr"),
    "कशी आहेस": ("How are you?", "mr"),
    "कशी आहेस?": ("How are you?", "mr"),
    "नमस्कार": ("Hello", "mr"),
    "आभार": ("Thank you", "mr"),
    "मी ठीक आहे": ("I am fine", "mr"),
}


@dataclass
class TranslationResult:
    original_text: str
    detected_language: str
    confidence: float
    is_english: bool
    translated_text: str
    semantic_frame: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            "original_text": self.original_text,
            "detected_language": self.detected_language,
            "confidence": self.confidence,
            "is_english": self.is_english,
            "translated_text": self.translated_text,
        }
        if self.semantic_frame:
            d["semantic_frame"] = self.semantic_frame
        return d


class MultilingualService:
    """
    Multilingual detection and translation service for SignVision ISL.
    Supports:
      - English (en) -> 0 Groq calls (Local spaCy fast path)
      - Hindi Devanagari (hi) -> 1 Groq call (Single combined translation + extraction)
      - Hindi Romanized / Hinglish (hi-Latn) -> 1 Groq call (Single combined translation + extraction)
      - Marathi Devanagari (mr) -> 1 Groq call (Single combined translation + extraction)
      - Marathi Romanized / Marathish (mr-Latn) -> 1 Groq call (Single combined translation + extraction)
    """

    def __init__(self):
        self._cache: Dict[str, TranslationResult] = {}
        self._max_cache_size = 500

    def clear_cache(self) -> None:
        self._cache.clear()

    def has_devanagari(self, text: str) -> bool:
        """Check if string contains any Devanagari script characters."""
        return bool(DEVANAGARI_PATTERN.search(text))

    def detect_devanagari_language(self, text: str) -> str:
        """Lightweight heuristic to distinguish Hindi from Marathi in Devanagari script."""
        # Marathi letter LLA (ळ) is exclusively Marathi
        if "ळ" in text:
            return "mr"

        tokens = set(text.strip().split())
        marathi_hits = len(tokens & MARATHI_DEVANAGARI_MARKERS)
        hindi_hits = len(tokens & HINDI_DEVANAGARI_MARKERS)

        if marathi_hits > hindi_hits:
            return "mr"
        if hindi_hits > marathi_hits:
            return "hi"
        # Default to hi if ambiguous
        return "hi"

    def is_obvious_english(self, text: str) -> bool:
        """Check if sentence is definitively English without needing LLM translation."""
        clean = text.lower().strip()
        clean_no_punct = re.sub(r"[^\w\s]", "", clean).strip()

        if clean_no_punct in FIXED_ENGLISH_EXPRESSIONS:
            return True

        return False

    def detect_and_translate(
        self,
        text: str,
        source_lang: Optional[str] = None,
    ) -> TranslationResult:
        """
        Detect language of text and translate into English if needed.
        Preserves meaning, tense, questions, negation, and entities.
        For English: bypasses Groq translation entirely (0 Groq calls).
        For Indic: combines translation and semantic extraction in 1 Groq call.
        """
        stripped = text.strip()
        if not stripped:
            raise ValueError("Empty input text")

        cache_key = f"{source_lang or 'auto'}:{stripped.lower()}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        # 1. Fast-path: Obvious fixed English expression
        if self.is_obvious_english(stripped):
            result = TranslationResult(
                original_text=stripped,
                detected_language="en",
                confidence=1.0,
                is_english=True,
                translated_text=stripped,
                semantic_frame=None,
            )
            self._save_cache(cache_key, result)
            return result

        # 2. Fast-path: Common offline translation dictionary
        normalized_lookup = stripped.lower().strip()
        if normalized_lookup in OFFLINE_TRANSLATIONS:
            trans_text, lang = OFFLINE_TRANSLATIONS[normalized_lookup]
            result = TranslationResult(
                original_text=stripped,
                detected_language=lang,
                confidence=0.98,
                is_english=False,
                translated_text=trans_text,
                semantic_frame=None,
            )
            self._save_cache(cache_key, result)
            return result

        # Also check without trailing punctuation in offline dict
        no_punct_lookup = re.sub(r"[^\w\s]", "", normalized_lookup).strip()
        if no_punct_lookup in OFFLINE_TRANSLATIONS:
            trans_text, lang = OFFLINE_TRANSLATIONS[no_punct_lookup]
            result = TranslationResult(
                original_text=stripped,
                detected_language=lang,
                confidence=0.98,
                is_english=False,
                translated_text=trans_text,
                semantic_frame=None,
            )
            self._save_cache(cache_key, result)
            return result

        # 3. Detect if text is definitely English without Indic characters or Romanized Indic tokens
        is_explicit_english = (source_lang == "en")
        is_explicit_indic = (source_lang in ("hi", "mr", "hi-Latn", "mr-Latn"))
        has_indic_script = self.has_devanagari(stripped)

        # Check for Romanized Indic words in Latin script
        words = re.findall(r"\b[a-zA-Z]+\b", stripped.lower())
        has_romanized_indic = any(w in ROMANIZED_INDIC_TOKENS for w in words)

        if not is_explicit_indic and not has_indic_script and not has_romanized_indic:
            # Normal English input! Do NOT call Groq to translate English into English.
            logger.info("Language detected as English: bypassing Groq multilingual translation (0 calls)")
            result = TranslationResult(
                original_text=stripped,
                detected_language="en",
                confidence=0.98,
                is_english=True,
                translated_text=stripped,
                semantic_frame=None,
            )
            self._save_cache(cache_key, result)
            return result

        # 4. Indic input: LLM Single Combined Translation + Semantic Extraction via Groq
        try:
            result = self._translate_with_llm(stripped, source_lang)
            self._save_cache(cache_key, result)
            return result
        except Exception as e:
            logger.error(f"LLM translation failed for '{stripped}': {e}")

            # Keep Indic speech usable when Groq is temporarily unreachable.
            try:
                translated = self._translate_with_google(stripped)
                fallback_language = source_lang if source_lang in ("hi", "mr", "hi-Latn", "mr-Latn") else (
                    self.detect_devanagari_language(stripped) if has_indic_script else "hi-Latn"
                )
                result = TranslationResult(
                    original_text=stripped,
                    detected_language=fallback_language,
                    confidence=0.85,
                    is_english=False,
                    translated_text=translated,
                    semantic_frame=None,
                )
                self._save_cache(cache_key, result)
                logger.info("Google Translate fallback succeeded for Indic input (%s)", fallback_language)
                return result
            except Exception as fallback_error:
                logger.warning("Google Translate fallback failed: %s", fallback_error)

            # If text had Devanagari script and LLM failed, we cannot pass Devanagari to English NLP
            if self.has_devanagari(stripped):
                raise ValueError(
                    f"Translation service unavailable for Indic text: '{stripped}'. Please check network or try again."
                )

            # If explicit non-English was requested, raise error
            if source_lang in ("hi", "mr", "hi-Latn", "mr-Latn"):
                raise ValueError(
                    f"Translation service unavailable for {source_lang} text. Please try again."
                )

            raise ValueError(
                f"Could not translate or verify language for: '{stripped}'. Please check your input or connection."
            )

    @staticmethod
    def _translate_with_google(text: str) -> str:
        """Translate text to English with Google's public web translation endpoint."""
        import json
        from urllib.parse import urlencode
        from urllib.request import Request, urlopen

        query = urlencode({"client": "gtx", "sl": "auto", "tl": "en", "dt": "t", "q": text})
        request = Request(
            f"https://translate.googleapis.com/translate_a/single?{query}",
            headers={"User-Agent": "SignVision/1.0"},
        )
        with urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))

        translated = "".join(
            segment[0]
            for segment in payload[0]
            if isinstance(segment, list) and segment and isinstance(segment[0], str)
        ).strip()
        if not translated or DEVANAGARI_PATTERN.search(translated):
            raise ValueError("Google Translate returned an empty or non-English result")
        return translated

    def _translate_with_llm(
        self, text: str, source_lang: Optional[str] = None
    ) -> TranslationResult:
        """
        Performs single combined Groq request:
        Translates Hindi/Marathi/Romanized Indic to normalized English AND extracts structured SemanticFrame.
        """
        from ..core.nlp_engine import call_llm, SemanticFrame

        lang_hint = f" The user explicitly specified source language: '{source_lang}'." if source_lang and source_lang != 'auto' else ""

        prompt = f"""You are a multilingual language detector, translator, and semantic extraction engine for an Indian Sign Language (ISL) system.
Supported languages:
- 'en': English
- 'hi': Hindi (Devanagari script)
- 'hi-Latn': Hindi in Roman/Latin script (Hinglish, e.g. 'kya aapne khana khaya', 'kya apne khana khya', 'mai seb kha raha hu')
- 'mr': Marathi (Devanagari script)
- 'mr-Latn': Marathi in Roman/Latin script (Marathish, e.g. 'jeven kela ka', 'tumhi jevan kela ka', 'jevla ka')

Task instructions:{lang_hint}
1. Detect the language code ('en', 'hi', 'hi-Latn', 'mr', 'mr-Latn').
2. If the input is in English ('en'), set is_english to true and translated_text to the exact English sentence.
3. If the input is in Hindi or Marathi (in Devanagari OR Romanized Latin script):
   - Translate its meaning accurately into natural, clear, concise English suitable for Indian Sign Language parsing.
   - Questions MUST remain questions (e.g. 'Have you eaten food?', 'Where is the hospital?').
   - Negations MUST remain negative ('not', 'never').
   - Tense MUST be preserved (past, present, future).
   - Proper names, nouns, and entities MUST be preserved ('Rahul', 'Delhi').
4. Extract the structured "semantic_frame" for ISL gloss generation:
   - "subject": main subject pronoun or entity (e.g. "you", "i", "he", "she", "we", "rahul"). For possessives, extract possessor pronoun ("you", "i").
   - "object": real entity receiving action, identity complement, or possessed noun. Never include WH-words. If none, null.
   - "tense": "PAST", "PRESENT", or "FUTURE".
   - "negation": true if negative (not, never, no), else false.
   - "sentence_type": "statement", "yes_no_question", or "wh_question".
   - "normalized_verb": base root action verb (e.g. "eat", "go", "read", "come"). Never auxiliary verbs (is, am, are, was, were). For state sentences ("I am sick", "She is happy"), set to null.
   - "adjective": predicative adjective describing state (e.g. "sick", "happy", "tired", "hungry"), else null.
   - "important_phrases": list of objects with "phrase" and "meaning" if relevant, else [].
   - "has_explicit_time_word": true if explicit time words (e.g. yesterday, today, tomorrow, now), else false.
   - "requires_time_marker": true for action sentences needing temporal markers, false for state/greeting/continuous questions.
   - "raw_gloss_tokens": list of uppercase words in ISL grammatical order (Time -> Subject/Topic/Pronouns -> Objects/Modifiers -> Adjectives -> Verbs -> Negation -> Question). Preserve ALL content words without artificially reducing to 3 words.
   - "confidence": integer (0-100).

Input: "{text}"

Return ONLY a valid JSON object matching this exact schema with NO extra commentary or explanation:
{{
  "detected_language": "hi|hi-Latn|mr|mr-Latn|en",
  "confidence": 0.95,
  "is_english": false,
  "translated_text": "Have you eaten food?",
  "semantic_frame": {{
    "subject": "you",
    "object": "food",
    "tense": "PAST",
    "negation": false,
    "sentence_type": "yes_no_question",
    "normalized_verb": "eat",
    "adjective": null,
    "important_phrases": [],
    "has_explicit_time_word": false,
    "requires_time_marker": false,
    "confidence": 95,
    "raw_gloss_tokens": ["YOU", "FOOD", "EAT", "Q"]
  }}
}}"""

        parsed = call_llm(prompt, max_tokens=512)

        detected_lang = str(parsed.get("detected_language", "en")).strip()
        confidence = float(parsed.get("confidence", 0.9))
        is_english = bool(parsed.get("is_english", False))
        translated_text = str(parsed.get("translated_text", "")).strip()

        # Sanitize translated text: remove surrounding quotes if any
        if (translated_text.startswith('"') and translated_text.endswith('"')) or (
            translated_text.startswith("'") and translated_text.endswith("'")
        ):
            translated_text = translated_text[1:-1].strip()

        # Validation
        if not translated_text:
            raise ValueError(f"LLM produced empty translation for '{text}'")

        if self.has_devanagari(translated_text):
            raise ValueError(
                f"Translation still contains Devanagari script: '{translated_text}'"
            )

        # Normalize is_english flag
        if detected_lang == "en":
            is_english = True

        # Extract and validate semantic frame if present
        raw_frame = parsed.get("semantic_frame")
        semantic_frame_dict = None
        if isinstance(raw_frame, dict):
            try:
                raw_gloss = raw_frame.get("raw_gloss_tokens")
                if isinstance(raw_gloss, list):
                    raw_gloss = [str(t).upper().strip() for t in raw_gloss if str(t).strip()]
                else:
                    raw_gloss = None

                frame = SemanticFrame(
                    subject=raw_frame.get("subject"),
                    object=raw_frame.get("object"),
                    tense=str(raw_frame.get("tense", "PRESENT")).upper(),
                    negation=bool(raw_frame.get("negation", False)),
                    sentence_type=str(raw_frame.get("sentence_type", "statement")),
                    normalized_verb=raw_frame.get("normalized_verb"),
                    adjective=raw_frame.get("adjective"),
                    question_word=raw_frame.get("question_word"),
                    important_phrases=raw_frame.get("important_phrases") or [],
                    has_explicit_time_word=bool(raw_frame.get("has_explicit_time_word", False)),
                    requires_time_marker=bool(raw_frame.get("requires_time_marker", False)),
                    confidence=int(raw_frame.get("confidence", 90)) if isinstance(raw_frame.get("confidence"), (int, float)) else 90,
                    extraction_source="groq",
                    raw_gloss_tokens=raw_gloss,
                )
                semantic_frame_dict = frame.to_dict()
            except Exception as e:
                logger.warning(f"Could not parse semantic_frame from LLM: {e}")

        return TranslationResult(
            original_text=text,
            detected_language=detected_lang,
            confidence=confidence,
            is_english=is_english,
            translated_text=translated_text,
            semantic_frame=semantic_frame_dict,
        )

    def _save_cache(self, key: str, result: TranslationResult) -> None:
        if len(self._cache) >= self._max_cache_size:
            # Remove oldest entry
            self._cache.pop(next(iter(self._cache)))
        self._cache[key] = result


# Global singleton instance
multilingual_service = MultilingualService()
