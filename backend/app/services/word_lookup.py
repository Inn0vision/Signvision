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

        logger.info(f"Loaded {len(self._sign_data)} sign entries")
        self._initialized = True

    def _normalize_word(self, word: str) -> str:
        return word.strip().upper().replace(" ", "_")

    def _has_valid_url(self, entry: Dict) -> bool:
        return bool(entry.get("s3_url"))

    def lookup(
        self, query: str, use_semantic_fallback: bool = True
    ) -> WordLookupResult:
        if not self._initialized:
            self.initialize()

        normalized = self._normalize_word(query)
        original = query.strip()

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

        for word, entry in self._sign_data.items():
            if normalized in word or word in normalized:
                if self._has_valid_url(entry):
                    return WordLookupResult(
                        word=word,
                        original_query=original,
                        found=True,
                        s3_url=entry["s3_url"],
                        match_type="partial",
                    )

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

        return WordLookupResult(
            word=normalized,
            original_query=original,
            found=False,
            s3_url=None,
            match_type="none",
        )

    def lookup_gloss_sequence(
        self, gloss_tokens: List[str], use_semantic_fallback: bool = True
    ) -> List[WordLookupResult]:
        results = []
        for token in gloss_tokens:
            result = self.lookup(token, use_semantic_fallback=use_semantic_fallback)
            results.append(result)
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
