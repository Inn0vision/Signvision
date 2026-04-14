import logging
import os
from typing import List, Tuple, Optional
from pathlib import Path

from sentence_transformers import SentenceTransformer
import chromadb

from ..core.config import settings

# Disable SSL verification for HuggingFace downloads (needed for self-signed certificates)
os.environ["CURL_CA_BUNDLE"] = ""
os.environ["REQUESTS_CA_BUNDLE"] = ""
os.environ["HF_HUB_DISABLE_SSL_VERIFY"] = "1"

logger = logging.getLogger("semantic_search")


class SemanticSearchService:
    def __init__(self):
        self._model: Optional[SentenceTransformer] = None
        self._collection = None
        self._initialized = False

    def initialize(self):
        if self._initialized:
            return

        logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
        self._model = SentenceTransformer(settings.EMBEDDING_MODEL)

        chroma_path = Path(settings.CHROMA_DB_PATH)
        if not chroma_path.exists():
            logger.warning(
                f"ChromaDB path does not exist: {chroma_path}. Run build_embeddings first."
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
            logger.warning(f"Collection not found: {e}. Run build_embeddings first.")

        self._initialized = True

    def search(
        self, query: str, top_k: int = None, min_similarity: float = None
    ) -> List[Tuple[str, float]]:
        if not self._initialized:
            self.initialize()

        if self._model is None or self._collection is None:
            logger.warning(
                "Semantic search not available - model or collection not loaded"
            )
            return []

        top_k = top_k or settings.SEMANTIC_SEARCH_TOP_K
        min_similarity = min_similarity or settings.SEMANTIC_SEARCH_MIN_SIMILARITY

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

    def find_similar_word(self, query: str) -> Optional[str]:
        results = self.search(query, top_k=1)
        if results:
            return results[0][0]
        return None


def build_embeddings(words_file: Path = None):
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
