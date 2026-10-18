import logging
from typing import List, Tuple, Optional
from pathlib import Path

from ..core.config import settings

logger = logging.getLogger("semantic_search")


def _get_bigrams(s: str) -> set:
    s = s.lower()
    return {s[i : i + 2] for i in range(len(s) - 1)}


def dice_similarity(str1: str, str2: str) -> float:
    """Computes Sørensen–Dice coefficient similarity between two strings."""
    if str1.lower() == str2.lower():
        return 1.0
    if len(str1) < 2 or len(str2) < 2:
        return 0.0
    bg1 = _get_bigrams(str1)
    bg2 = _get_bigrams(str2)
    if not bg1 or not bg2:
        return 0.0
    intersection = len(bg1 & bg2)
    return (2.0 * intersection) / (len(bg1) + len(bg2))


class SemanticSearchService:
    def __init__(self):
        self._model = None
        self._collection = None
        self._initialized = False
        self._fallback_words: Optional[List[str]] = None

    def _get_fallback_words(self) -> List[str]:
        if self._fallback_words is not None:
            return self._fallback_words

        words_file = settings.DATA_DIR / settings.WORDS_FILE
        if words_file.exists():
            try:
                with open(words_file, "r", encoding="utf-8") as f:
                    self._fallback_words = [line.strip().upper() for line in f if line.strip()]
                return self._fallback_words
            except Exception as e:
                logger.warning(f"Failed to load words from {words_file}: {e}")

        # Fallback to sign_language_data.json keys
        data_file = settings.DATA_DIR / "sign_language_data.json"
        if data_file.exists():
            try:
                import json
                with open(data_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._fallback_words = list(data.keys())
                return self._fallback_words
            except Exception as e:
                logger.warning(f"Failed to load words from {data_file}: {e}")

        self._fallback_words = []
        return self._fallback_words

    def initialize(self):
        if self._initialized:
            return

        try:
            from sentence_transformers import SentenceTransformer
            import chromadb

            logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
            self._model = SentenceTransformer(settings.EMBEDDING_MODEL)

            chroma_path = Path(settings.CHROMA_DB_PATH)
            if not chroma_path.exists():
                logger.warning(
                    f"ChromaDB path does not exist: {chroma_path}. Using Dice fallback search until index is built."
                )
                self._initialized = True
                return

            logger.info(f"Connecting to ChromaDB at: {chroma_path}")
            client = chromadb.PersistentClient(path=str(chroma_path))

            try:
                self._collection = client.get_collection(settings.CHROMA_COLLECTION)
                count = self._collection.count()
                if count == 0:
                    logger.warning(f"ChromaDB collection '{settings.CHROMA_COLLECTION}' is empty. Using Dice fallback.")
                else:
                    logger.info(
                        f"Loaded collection '{settings.CHROMA_COLLECTION}' with {count} items"
                    )
            except Exception as e:
                logger.warning(f"Collection not found: {e}. Using Dice fallback search.")

        except ImportError as e:
            logger.warning(f"Semantic search packages not installed: {e}. Operating in lightweight Dice fallback mode.")
        except Exception as e:
            logger.warning(f"Semantic search initialization failed: {e}. Operating in lightweight Dice fallback mode.")

        self._initialized = True

    def _dice_search(
        self, query: str, top_k: int, min_similarity: float
    ) -> List[Tuple[str, float]]:
        words = self._get_fallback_words()
        if not words:
            return []
        scored = []
        for w in words:
            score = dice_similarity(query, w)
            if score >= min_similarity:
                scored.append((w, round(score, 4)))
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]

    def search(
        self, query: str, top_k: int = None, min_similarity: float = None
    ) -> List[Tuple[str, float]]:
        if not self._initialized:
            self.initialize()

        top_k = top_k or settings.SEMANTIC_SEARCH_TOP_K
        min_similarity = min_similarity or settings.SEMANTIC_SEARCH_MIN_SIMILARITY

        if self._model is None or self._collection is None or self._collection.count() == 0:
            return self._dice_search(query, top_k, min_similarity)

        try:
            vec = self._model.encode([query.strip().lower()]).tolist()
            # Fetch extra candidates to account for deduplicating canonical signs and aliases
            query_limit = min(max(top_k * 4, 15), self._collection.count())
            results = self._collection.query(
                query_embeddings=vec,
                n_results=query_limit,
                include=["documents", "distances", "metadatas"],
            )

            if not results or not results.get("distances") or not results["distances"][0]:
                return []

            distances = results["distances"][0]
            metadatas = results.get("metadatas", [[]])[0]
            documents = results.get("documents", [[]])[0]

            # In ChromaDB cosine space, cosine distance = 1 - cosine_similarity.
            # Thus, cosine_similarity = 1.0 - distance.
            best_by_canonical: dict[str, float] = {}
            for dist, meta, doc in zip(distances, metadatas, documents):
                similarity = round(1.0 - float(dist), 4)
                if similarity < min_similarity:
                    continue

                canonical = meta.get("canonical_word") if meta else doc
                if not canonical:
                    canonical = doc

                canonical_upper = str(canonical).strip().upper()
                if canonical_upper not in best_by_canonical or similarity > best_by_canonical[canonical_upper]:
                    best_by_canonical[canonical_upper] = similarity

            ranked = sorted(best_by_canonical.items(), key=lambda x: x[1], reverse=True)
            return ranked[:top_k]
        except Exception as e:
            logger.warning(f"ChromaDB search failed: {e}, falling back to Dice coefficient")
            return self._dice_search(query, top_k, min_similarity)

    def find_similar_word(self, query: str) -> Optional[str]:
        results = self.search(query, top_k=1)
        if results:
            return results[0][0]
        return None


def build_embeddings(data_file: Optional[Path] = None, chroma_path: Optional[Path] = None):
    """
    Builds a reproducible, idempotent ChromaDB vector index from the sign language dictionary.
    Indexes only canonical signs and approved aliases that have verified, playable animation assets.
    """
    import json
    from urllib.parse import urlparse

    try:
        from sentence_transformers import SentenceTransformer
        import chromadb
    except ImportError as e:
        logger.error(f"Cannot build embeddings without sentence_transformers and chromadb: {e}")
        return

    data_file = data_file or settings.DATA_DIR / settings.SIGN_LANGUAGE_DATA_FILE
    chroma_path = chroma_path or Path(settings.CHROMA_DB_PATH)

    logger.info(f"Loading sign language data from '{data_file}'")
    with open(data_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    def is_valid_playable_url(url: str) -> bool:
        if not url or not isinstance(url, str):
            return False
        parsed = urlparse(url)
        return bool(parsed.scheme in ("http", "https") and parsed.netloc and parsed.path.endswith(".sigml"))

    # Filter for entries with valid, playable animation assets
    playable_entries = {k: v for k, v in data.items() if is_valid_playable_url(v.get("s3_url", ""))}
    logger.info(
        f"Filtered {len(playable_entries)} playable sign entries from {len(data)} total records "
        f"({len(data) - len(playable_entries)} omitted due to missing/invalid URLs)"
    )

    ids: List[str] = []
    documents: List[str] = []
    metadatas: List[dict] = []

    for canonical_word, entry in playable_entries.items():
        canonical_clean = canonical_word.strip().upper()
        s3_url = entry["s3_url"]
        category = entry.get("category", "")
        anchors = entry.get("anchors", [])

        # 1. Canonical sign entry
        ids.append(f"canonical:{canonical_clean}")
        documents.append(canonical_clean.lower())
        metadatas.append({
            "canonical_word": canonical_clean,
            "source_type": "canonical",
            "s3_url": s3_url,
            "category": str(category),
            "anchors": ", ".join(anchors),
        })

        # 2. Approved alias entries
        for alias in anchors:
            alias_clean = alias.strip().upper()
            if alias_clean and alias_clean != canonical_clean:
                alias_id = f"alias:{canonical_clean}:{alias_clean}"
                if alias_id not in ids:
                    ids.append(alias_id)
                    documents.append(alias_clean.lower())
                    metadatas.append({
                        "canonical_word": canonical_clean,
                        "source_type": "alias",
                        "s3_url": s3_url,
                        "category": str(category),
                        "anchors": ", ".join(anchors),
                    })

    logger.info(f"Generated {len(documents)} searchable index records ({len(playable_entries)} canonical, {len(documents) - len(playable_entries)} approved aliases)")

    logger.info(f"Loading embedding model '{settings.EMBEDDING_MODEL}'...")
    model = SentenceTransformer(settings.EMBEDDING_MODEL)

    logger.info("Computing embeddings...")
    embeddings = model.encode(documents, show_progress_bar=True, batch_size=64).tolist()

    chroma_path.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(chroma_path))

    existing = [c.name for c in client.list_collections()]
    if settings.CHROMA_COLLECTION in existing:
        client.delete_collection(settings.CHROMA_COLLECTION)
        logger.info(f"Deleted old collection '{settings.CHROMA_COLLECTION}' for clean idempotent rebuild")

    collection = client.create_collection(
        name=settings.CHROMA_COLLECTION,
        metadata={"hnsw:space": "cosine"}
    )

    logger.info("Adding records to ChromaDB collection...")
    # Add in batches of 500 for robust client ingestion
    batch_size = 500
    for i in range(0, len(ids), batch_size):
        end = min(i + batch_size, len(ids))
        collection.add(
            ids=ids[i:end],
            documents=documents[i:end],
            embeddings=embeddings[i:end],
            metadatas=metadatas[i:end],
        )

    logger.info(f"Successfully built and verified ChromaDB index with {collection.count()} records at '{chroma_path}'")


semantic_search_service = SemanticSearchService()
