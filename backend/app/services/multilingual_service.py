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

    def to_dict(self) -> Dict[str, Any]:
        return {
            "original_text": self.original_text,
            "detected_language": self.detected_language,
            "confidence": self.confidence,
            "is_english": self.is_english,
            "translated_text": self.translated_text,
        }


class MultilingualService:
    """
    Multilingual detection and translation service for SignVision ISL.
    Supports:
      - English (en)
      - Hindi Devanagari (hi)
      - Hindi Romanized / Hinglish (hi-Latn)
      - Marathi Devanagari (mr)
      - Marathi Romanized / Marathish (mr-Latn)
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
            )
            self._save_cache(cache_key, result)
            return result

        # 3. Fast-path: Common offline translation dictionary
        normalized_lookup = stripped.lower().strip()
        if normalized_lookup in OFFLINE_TRANSLATIONS:
            trans_text, lang = OFFLINE_TRANSLATIONS[normalized_lookup]
            result = TranslationResult(
                original_text=stripped,
                detected_language=lang,
                confidence=0.98,
                is_english=False,
                translated_text=trans_text,
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
            )
            self._save_cache(cache_key, result)
            return result

        # 4. LLM Translation via Groq
        try:
            result = self._translate_with_llm(stripped, source_lang)
            self._save_cache(cache_key, result)
            return result
        except Exception as e:
            logger.error(f"LLM translation failed for '{stripped}': {e}")

            # If text had Devanagari script and LLM failed, we cannot pass Devanagari to English NLP
            if self.has_devanagari(stripped):
                raise ValueError(
                    f"Translation service unavailable for Indic text: '{stripped}'. Please check network or try again."
                )

            # For Latin script where LLM failed:
            # Check if it looks like English words
            words = stripped.split()
            # If explicit non-English was requested, raise error
            if source_lang in ("hi", "mr", "hi-Latn", "mr-Latn"):
                raise ValueError(
                    f"Translation service unavailable for {source_lang} text. Please try again."
                )

            # If source_lang was auto, and LLM failed, fail safely with informative message
            # rather than silently feeding Hindi/Marathi Romanized slang into English NLP
            raise ValueError(
                f"Could not translate or verify language for: '{stripped}'. Please check your input or connection."
            )

    def _translate_with_llm(
        self, text: str, source_lang: Optional[str] = None
    ) -> TranslationResult:
        from ..core.nlp_engine import call_llm

        lang_hint = f" The user explicitly specified source language: '{source_lang}'." if source_lang and source_lang != 'auto' else ""

        prompt = f"""You are a multilingual language detector and translator for an Indian Sign Language (ISL) system.
Supported languages:
- 'en': English
- 'hi': Hindi (Devanagari script)
- 'hi-Latn': Hindi in Roman/Latin script (Hinglish, e.g. 'kya aapne khana khaya', 'kya apne khana khya', 'mai seb kha raha hu')
- 'mr': Marathi (Devanagari script)
- 'mr-Latn': Marathi in Roman/Latin script (Marathish, e.g. 'jeven kela ka', 'tumhi jevan kela ka', 'jevla ka')

Task instructions:{lang_hint}
1. Detect the language code ('en', 'hi', 'hi-Latn', 'mr', 'mr-Latn').
2. If the input is in English ('en'), set is_english to true and translated_text to the exact English sentence.
3. If the input is in Hindi or Marathi (in Devanagari OR Romanized Latin script), translate its meaning accurately into natural, clear, concise English suitable for Indian Sign Language parsing.
   Examples:
   - 'kya apne khana khya' -> 'Have you eaten food?'
   - 'kya aapne khana khaya?' -> 'Have you eaten food?'
   - 'क्या आपने खाना खाया?' -> 'Have you eaten food?'
   - 'jeven kela ka' -> 'Have you eaten food?'
   - 'tumhi jevan kela ka?' -> 'Have you eaten food?'
   - 'तुम्ही जेवण केले का?' -> 'Have you eaten food?'
   - 'I am eating an apple' -> 'I am eating an apple'
   - 'Rahul went to school' -> 'Rahul went to school'
4. Critical translation preservation rules:
   - Questions MUST remain questions (e.g. 'Have you eaten?', 'Where is the hospital?').
   - Negations MUST remain negative ('not', 'never').
   - Tense MUST be preserved (past, present, future).
   - Proper names, nouns, and entities MUST be preserved ('Rahul', 'Delhi').
5. Validate output: translated_text MUST be natural English. Never return apologies, explanations, or quotes.

Input: "{text}"

Return ONLY a valid JSON object matching this exact schema:
{{
  "detected_language": "en|hi|hi-Latn|mr|mr-Latn",
  "confidence": 0.95,
  "is_english": false,
  "translated_text": "..."
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

        return TranslationResult(
            original_text=text,
            detected_language=detected_lang,
            confidence=confidence,
            is_english=is_english,
            translated_text=translated_text,
        )

    def _save_cache(self, key: str, result: TranslationResult) -> None:
        if len(self._cache) >= self._max_cache_size:
            # Remove oldest entry
            self._cache.pop(next(iter(self._cache)))
        self._cache[key] = result


# Global singleton instance
multilingual_service = MultilingualService()
