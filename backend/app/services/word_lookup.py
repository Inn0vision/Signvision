import re
import json
import logging
from typing import Dict, List, Optional
from pathlib import Path
from dataclasses import dataclass

from ..core.config import settings
from .semantic_search import semantic_search_service

logger = logging.getLogger("word_lookup")


@dataclass
class WordLookupResult:
    word: str
    original_query: str
    found: bool
    s3_url: Optional[str]
    match_type: str
    similar_words: List[str] = None

    def to_dict(self) -> Dict:
        return {
            "word": self.word,
            "original_query": self.original_query,
            "found": self.found,
            "s3_url": self.s3_url,
            "match_type": self.match_type,
            "similar_words": self.similar_words or [],
        }


class WordLookupService:
    def __init__(self):
        self._sign_data: Dict = {}
        self._initialized = False
        self._letter_cache: Dict[str, str] = {}
        self._digit_cache: Dict[str, str] = {}

    def initialize(self):
        if self._initialized:
            return

        data_file = settings.DATA_DIR / settings.SIGN_LANGUAGE_DATA_FILE

        if not data_file.exists():
            logger.error(f"Sign language data file not found: {data_file}")
            self._initialized = True
            return

        logger.info(f"Loading sign language data from: {data_file}")
        with open(data_file, "r", encoding="utf-8") as f:
            self._sign_data = json.load(f)

        # Cache verified letter assets (A-Z)
        for char_code in range(ord('A'), ord('Z') + 1):
            letter = chr(char_code)
            if letter in self._sign_data and self._has_valid_url(self._sign_data[letter]):
                self._letter_cache[letter] = self._sign_data[letter]["s3_url"]

        # Cache verified digit assets (0-9 mapped to number sign entries)
        digit_map = {
            "0": "ZERO",
            "1": "ONE",
            "2": "TWO",
            "3": "THREE",
            "4": "FOUR",
            "5": "FIVE",
            "6": "SIX",
            "7": "SEVEN",
            "8": "EIGHT",
            "9": "NINE",
        }
        for digit, word_name in digit_map.items():
            if word_name in self._sign_data and self._has_valid_url(self._sign_data[word_name]):
                self._digit_cache[digit] = self._sign_data[word_name]["s3_url"]

        logger.info(
            f"Loaded {len(self._sign_data)} sign entries with "
            f"{len(self._letter_cache)} letters and {len(self._digit_cache)} digits verified"
        )
        self._initialized = True

    def _normalize_word(self, word: str) -> str:
        cleaned = re.sub(r"[^\w\s]", "", word)
        return " ".join(cleaned.strip().upper().split())

    def _has_valid_url(self, entry: Dict) -> bool:
        return bool(entry.get("s3_url"))

    def _morphological_match(self, normalized: str, original: str) -> Optional[WordLookupResult]:
        """Safe, verified morphological root matching (e.g. plurals and standard verb endings)."""
        candidates = []
        if normalized.endswith("IES") and len(normalized) > 4:
            candidates.append(normalized[:-3] + "Y")
        if normalized.endswith("ES") and len(normalized) > 3:
            candidates.append(normalized[:-2])
        if normalized.endswith("S") and len(normalized) > 2 and not normalized.endswith("SS"):
            candidates.append(normalized[:-1])
        if normalized.endswith("ING") and len(normalized) > 4:
            candidates.append(normalized[:-3])
            # e.g., RUNNING -> RUN
            if len(normalized) > 5 and normalized[-4] == normalized[-5]:
                candidates.append(normalized[:-4])
        if normalized.endswith("ED") and len(normalized) > 3:
            candidates.append(normalized[:-2])
            candidates.append(normalized[:-1])  # e.g., LIKED -> LIKE

        for cand in candidates:
            if cand in self._sign_data and self._has_valid_url(self._sign_data[cand]):
                return WordLookupResult(
                    word=cand,
                    original_query=original,
                    found=True,
                    s3_url=self._sign_data[cand]["s3_url"],
                    match_type="partial",
                )
        return None

    def lookup_fingerspell(self, query: str) -> List[WordLookupResult]:
        """
        Letter-by-letter fingerspelling for unresolved words or proper nouns (e.g. PRUTHVIRAJ).
        Every character resolves to a verified letter or digit sign asset.
        """
        if not self._initialized:
            self.initialize()

        results: List[WordLookupResult] = []
        # Split on whitespace to handle multiword inputs safely
        words = query.strip().split()
        for word_idx, w in enumerate(words):
            for ch in w:
                ch_upper = ch.upper()
                if ch_upper in self._letter_cache:
                    results.append(
                        WordLookupResult(
                            word=ch_upper,
                            original_query=ch,
                            found=True,
                            s3_url=self._letter_cache[ch_upper],
                            match_type="partial",
                        )
                    )
                elif ch in self._digit_cache:
                    results.append(
                        WordLookupResult(
                            word=ch,
                            original_query=ch,
                            found=True,
                            s3_url=self._digit_cache[ch],
                            match_type="partial",
                        )
                    )
                elif ch.isalnum():
                    # Alphanumeric character without asset
                    results.append(
                        WordLookupResult(
                            word=ch_upper,
                            original_query=ch,
                            found=False,
                            s3_url=None,
                            match_type="none",
                        )
                    )
        return results

    def lookup(
        self, query: str, use_semantic_fallback: bool = False, allow_fingerspell: bool = False
    ) -> WordLookupResult:
        """
        Strict 4-stage resolution policy:
        1. Exact dictionary match
        2. Approved alias/anchor match
        3. Safe, verified morphological match
        4. Fingerspelling (when allow_fingerspell=True) or structured not-found
        """
        if not self._initialized:
            self.initialize()

        normalized = self._normalize_word(query)
        original = query.strip()

        if not normalized:
            return WordLookupResult(
                word="",
                original_query=original,
                found=False,
                s3_url=None,
                match_type="none",
            )

        # 1. Exact dictionary match
        if normalized in self._sign_data:
            entry = self._sign_data[normalized]
            if self._has_valid_url(entry):
                return WordLookupResult(
                    word=normalized,
                    original_query=original,
                    found=True,
                    s3_url=entry["s3_url"],
                    match_type="exact",
                )

        # 2. Approved alias match
        for word, entry in self._sign_data.items():
            anchors = entry.get("anchors", [])
            if normalized in [a.upper() for a in anchors]:
                if self._has_valid_url(entry):
                    return WordLookupResult(
                        word=word,
                        original_query=original,
                        found=True,
                        s3_url=entry["s3_url"],
                        match_type="anchor",
                    )

        # 3. Safe, verified morphological match
        morph_match = self._morphological_match(normalized, original)
        if morph_match:
            return morph_match

        # Substring partial match for compounds (only if length > 2)
        for word, entry in self._sign_data.items():
            if len(word) > 2 and len(normalized) > 2:
                if normalized in word or word in normalized:
                    if self._has_valid_url(entry):
                        return WordLookupResult(
                            word=word,
                            original_query=original,
                            found=True,
                            s3_url=entry["s3_url"],
                            match_type="partial",
                        )

        # 4. Optional semantic search fallback for explicit semantic requests only
        if use_semantic_fallback:
            similar = semantic_search_service.search(query, top_k=5)
            for similar_word, score in similar:
                normalized_similar = self._normalize_word(similar_word)
                if normalized_similar in self._sign_data:
                    entry = self._sign_data[normalized_similar]
                    if self._has_valid_url(entry):
                        return WordLookupResult(
                            word=normalized_similar,
                            original_query=original,
                            found=True,
                            s3_url=entry["s3_url"],
                            match_type="semantic",
                            similar_words=[w for w, _ in similar],
                        )

            return WordLookupResult(
                word=normalized,
                original_query=original,
                found=False,
                s3_url=None,
                match_type="none",
                similar_words=[w for w, _ in similar] if similar else [],
            )

        # Fingerspelling fallback for single letter query if present
        if len(normalized) == 1 and normalized in self._letter_cache:
            return WordLookupResult(
                word=normalized,
                original_query=original,
                found=True,
                s3_url=self._letter_cache[normalized],
                match_type="partial",
            )

        return WordLookupResult(
            word=normalized,
            original_query=original,
            found=False,
            s3_url=None,
            match_type="none",
        )

    def lookup_gloss_sequence(
        self, gloss_tokens: List[str], use_semantic_fallback: bool = False
    ) -> List[WordLookupResult]:
        """
        Resolves sequence of GLOSS tokens. Unresolved words (names, places, unknown terms)
        are decomposed letter-by-letter via fingerspelling in correct character order.
        """
        results: List[WordLookupResult] = []
        for token in gloss_tokens:
            res = self.lookup(token, use_semantic_fallback=use_semantic_fallback)
            if res.found and res.s3_url:
                results.append(res)
            else:
                # 4. Fingerspelling fallback for unresolved words
                letter_results = self.lookup_fingerspell(token)
                if letter_results:
                    results.extend(letter_results)
                else:
                    results.append(res)
        return results

    def get_all_words(self) -> List[str]:
        if not self._initialized:
            self.initialize()
        return list(self._sign_data.keys())

    def get_word_count(self) -> int:
        if not self._initialized:
            self.initialize()
        return len(self._sign_data)


word_lookup_service = WordLookupService()

