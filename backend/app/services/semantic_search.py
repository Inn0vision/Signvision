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
                    f"ChromaDB path does not exist: {chroma_path}. Using Dice fallback search."
                )
                self._initialized = True
                return

            logger.info(f"Connecting to ChromaDB at: {chroma_path}")
            client = chromadb.PersistentClient(path=str(chroma_path))

            try:
                self._collection = client.get_collection(settings.CHROMA_COLLECTION)
                logger.info(
                    f"Loaded collection '{settings.CHROMA_COLLECTION}' with {self._collection.count()} words"
                )
            except Exception as e:
                logger.warning(f"Collection not found: {e}. Using Dice fallback search.")

        except ImportError as e:
            logger.warning(f"Semantic search packages (sentence_transformers/chromadb) not installed: {e}. Operating in lightweight Dice fallback mode.")
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

        if self._model is None or self._collection is None:
            return self._dice_search(query, top_k, min_similarity)

        try:
            vec = self._model.encode([query]).tolist()
            results = self._collection.query(
                query_embeddings=vec,
                n_results=top_k,
            )

            words = results["documents"][0]
            distances = results["distances"][0]

            output = [
                (word, round(1 - dist, 4))
                for word, dist in zip(words, distances)
                if (1 - dist) >= min_similarity
            ]
            return output
        except Exception as e:
            logger.warning(f"ChromaDB search failed: {e}, falling back to Dice coefficient")
            return self._dice_search(query, top_k, min_similarity)

    def find_similar_word(self, query: str) -> Optional[str]:
        results = self.search(query, top_k=1)
        if results:
            return results[0][0]
        return None


def build_embeddings(words_file: Path = None):
    try:
        from sentence_transformers import SentenceTransformer
        import chromadb
    except ImportError as e:
        logger.error(f"Cannot build embeddings without sentence_transformers and chromadb: {e}")
        return

    words_file = words_file or settings.DATA_DIR / settings.WORDS_FILE

    logger.info(f"Loading words from '{words_file}'")
    with open(words_file, "r", encoding="utf-8") as f:
        words = [line.strip() for line in f if line.strip()]
    logger.info(f"Loaded {len(words)} words")

    logger.info(f"Loading model '{settings.EMBEDDING_MODEL}'")
    model = SentenceTransformer(settings.EMBEDDING_MODEL)

    logger.info("Generating embeddings...")
    embeddings = model.encode(words, show_progress_bar=True).tolist()

    chroma_path = Path(settings.CHROMA_DB_PATH)
    chroma_path.mkdir(parents=True, exist_ok=True)

    client = chromadb.PersistentClient(path=str(chroma_path))

    existing = [c.name for c in client.list_collections()]
    if settings.CHROMA_COLLECTION in existing:
        client.delete_collection(settings.CHROMA_COLLECTION)
        logger.info(f"Deleted old collection '{settings.CHROMA_COLLECTION}'")

    collection = client.create_collection(
        name=settings.CHROMA_COLLECTION, metadata={"hnsw:space": "cosine"}
    )

    logger.info("Storing in ChromaDB...")
    collection.add(
        ids=[str(i) for i in range(len(words))],
        documents=words,
        embeddings=embeddings,
    )

    logger.info(f"Done! {collection.count()} words stored in '{chroma_path}'")


semantic_search_service = SemanticSearchService()
