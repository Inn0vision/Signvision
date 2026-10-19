import re
import json
import logging
from typing import Dict, List, Optional
from pathlib import Path
from dataclasses import dataclass
from urllib.parse import urlparse

from ..core.config import settings
from .semantic_search import semantic_search_service

try:
    from ..core.nlp_engine import nlp
except Exception:
    nlp = None

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
        self._canonical_map: Dict[str, str] = {}
        self._alias_map: Dict[str, str] = {}
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

        # Build canonical and alias lookup maps
        for canonical_key, entry in self._sign_data.items():
            if not self._has_valid_url(entry):
                continue

            canonical_clean = canonical_key.strip().upper()
            self._canonical_map[canonical_clean] = canonical_key

            # Normalized representation without hyphens/underscores
            norm_space = " ".join(re.split(r"[-_\s]+", canonical_clean)).strip()
            if norm_space and norm_space not in self._canonical_map:
                self._canonical_map[norm_space] = canonical_key

            clean_alnum = re.sub(r"[^\w\s]", "", norm_space).strip()
            if clean_alnum and clean_alnum not in self._canonical_map:
                self._canonical_map[clean_alnum] = canonical_key

            # Map approved anchors/aliases
            for anchor in entry.get("anchors", []):
                anchor_upper = anchor.strip().upper()
                if not anchor_upper:
                    continue
                if anchor_upper not in self._alias_map:
                    self._alias_map[anchor_upper] = canonical_key

                norm_anchor = " ".join(re.split(r"[-_\s]+", anchor_upper)).strip()
                if norm_anchor and norm_anchor not in self._alias_map:
                    self._alias_map[norm_anchor] = canonical_key

                clean_anchor = re.sub(r"[^\w\s]", "", norm_anchor).strip()
                if clean_anchor and clean_anchor not in self._alias_map:
                    self._alias_map[clean_anchor] = canonical_key

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
            f"Loaded {len(self._sign_data)} sign entries with {len(self._canonical_map)} canonical keys, "
            f"{len(self._alias_map)} approved aliases, {len(self._letter_cache)} letters, and {len(self._digit_cache)} digits"
        )
        self._initialized = True

    def _normalize_word(self, word: str) -> str:
        cleaned = re.sub(r"[^\w\s-]", "", word)
        return " ".join(cleaned.strip().upper().split())

    def _has_valid_url(self, entry: Dict) -> bool:
        url = entry.get("s3_url")
        if not url or not isinstance(url, str):
            return False
        parsed = urlparse(url)
        return bool(parsed.scheme in ("http", "https") and parsed.netloc and parsed.path.endswith(".sigml"))

    def _resolve_canonical(self, term: str) -> Optional[str]:
        if not term:
            return None
        upper = term.strip().upper()
        if upper in self._canonical_map:
            return self._canonical_map[upper]
        norm = " ".join(re.split(r"[-_\s]+", upper)).strip()
        if norm in self._canonical_map:
            return self._canonical_map[norm]
        clean = re.sub(r"[^\w\s]", "", norm).strip()
        if clean in self._canonical_map:
            return self._canonical_map[clean]
        if upper in self._sign_data and self._has_valid_url(self._sign_data[upper]):
            return upper
        return None

    def _morphological_match(self, normalized: str, original: str) -> Optional[WordLookupResult]:
        """Safe morphological normalization using spaCy lemma when available, with conservative rule fallbacks."""
        # 1. spaCy lemmatization
        if nlp is not None:
            try:
                doc = nlp(original.strip())
                if doc and len(doc) == 1:
                    lemma_upper = doc[0].lemma_.strip().upper()
                    if lemma_upper and lemma_upper != normalized:
                        canon = self._resolve_canonical(lemma_upper)
                        if canon and self._has_valid_url(self._sign_data[canon]):
                            return WordLookupResult(
                                word=canon,
                                original_query=original,
                                found=True,
                                s3_url=self._sign_data[canon]["s3_url"],
                                match_type="partial",
                            )
            except Exception:
                pass

        # 2. Conservative inflectional rule fallbacks
        clean = re.sub(r"[^\w\s]", "", normalized).strip()
        candidates = []
        if clean.endswith("IES") and len(clean) > 4:
            candidates.append(clean[:-3] + "Y")
        if clean.endswith("ES") and len(clean) > 3:
            candidates.append(clean[:-2])
        if clean.endswith("S") and len(clean) > 2 and not clean.endswith("SS"):
            candidates.append(clean[:-1])
        if clean.endswith("ING") and len(clean) > 4:
            candidates.append(clean[:-3])
            # e.g., RUNNING -> RUN
            if len(clean) > 5 and clean[-4] == clean[-5]:
                candidates.append(clean[:-4])
        if clean.endswith("ED") and len(clean) > 3:
            candidates.append(clean[:-2])
            candidates.append(clean[:-1])  # e.g., LIKED -> LIKE

        for cand in candidates:
            canon = self._resolve_canonical(cand)
            if canon and self._has_valid_url(self._sign_data[canon]):
                return WordLookupResult(
                    word=canon,
                    original_query=original,
                    found=True,
                    s3_url=self._sign_data[canon]["s3_url"],
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
        Strict 5-stage lookup hierarchy:
        1. Exact canonical dictionary match
        2. Approved alias/anchor match
        3. Safe morphological & compound normalization
        4. Conservative semantic vector retrieval (ChromaDB)
        5. Fingerspelling / structured not-found
        """
        if not self._initialized:
            self.initialize()

        original = query.strip()
        normalized = self._normalize_word(original)

        if not normalized:
            return WordLookupResult(
                word="",
                original_query=original,
                found=False,
                s3_url=None,
                match_type="none",
            )

        # 1. Exact canonical dictionary match
        canonical_key = self._resolve_canonical(normalized)
        if canonical_key and canonical_key in self._sign_data:
            entry = self._sign_data[canonical_key]
            if self._has_valid_url(entry):
                return WordLookupResult(
                    word=canonical_key,
                    original_query=original,
                    found=True,
                    s3_url=entry["s3_url"],
                    match_type="exact",
                )

        # 2. Approved alias/anchor match
        clean_key = re.sub(r"[^\w\s]", "", normalized).strip()
        alias_target = self._alias_map.get(normalized) or self._alias_map.get(clean_key)
        if alias_target and alias_target in self._sign_data:
            entry = self._sign_data[alias_target]
            if self._has_valid_url(entry):
                return WordLookupResult(
                    word=alias_target,
                    original_query=original,
                    found=True,
                    s3_url=entry["s3_url"],
                    match_type="anchor",
                )

        # 3. Morphological normalization
        morph_match = self._morphological_match(normalized, original)
        if morph_match:
            return morph_match

        # 4. Conservative semantic vector retrieval
        if use_semantic_fallback:
            similar = semantic_search_service.search(query, top_k=settings.SEMANTIC_SEARCH_TOP_K)
            for similar_word, score in similar:
                if score >= settings.SEMANTIC_SEARCH_MIN_SIMILARITY:
                    canon = self._resolve_canonical(similar_word)
                    if canon and canon in self._sign_data:
                        entry = self._sign_data[canon]
                        if self._has_valid_url(entry):
                            return WordLookupResult(
                                word=canon,
                                original_query=original,
                                found=True,
                                s3_url=entry["s3_url"],
                                match_type="semantic",
                                similar_words=[w for w, _ in similar],
                            )

            return WordLookupResult(
                word=clean_key,
                original_query=original,
                found=False,
                s3_url=None,
                match_type="none",
                similar_words=[w for w, _ in similar] if similar else [],
            )

        # 5. Single letter / digit check
        if len(clean_key) == 1 and clean_key in self._letter_cache:
            return WordLookupResult(
                word=clean_key,
                original_query=original,
                found=True,
                s3_url=self._letter_cache[clean_key],
                match_type="partial",
            )

        return WordLookupResult(
            word=clean_key,
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
            sub_words = token.strip().split()
            # If multi-word token, check if it is an exact/anchor phrase (e.g. "THANK YOU", "GOOD MORNING")
            # If not an exact phrase, resolve each sub-word directly (e.g. "P SIGN" -> "P", "SIGN")
            if len(sub_words) > 1:
                exact_unit = self.lookup(token, use_semantic_fallback=False)
                if exact_unit.found and exact_unit.s3_url and exact_unit.match_type in ("exact", "anchor"):
                    results.append(exact_unit)
                    continue

                sub_results: List[WordLookupResult] = []
                for sub_w in sub_words:
                    sub_res = self.lookup(sub_w, use_semantic_fallback=use_semantic_fallback)
                    if sub_res.found and sub_res.s3_url:
                        sub_results.append(sub_res)
                    else:
                        letter_res = self.lookup_fingerspell(sub_w)
                        if letter_res:
                            sub_results.extend(letter_res)
                        else:
                            sub_results.append(sub_res)
                if sub_results and any(r.found for r in sub_results):
                    results.extend(sub_results)
                    continue

            res = self.lookup(token, use_semantic_fallback=use_semantic_fallback)
            if res.found and res.s3_url:
                results.append(res)
            else:
                # Fingerspelling fallback for unresolved words
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

