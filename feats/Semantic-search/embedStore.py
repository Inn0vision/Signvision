from sentence_transformers import SentenceTransformer
import chromadb

WORDS_FILE  = "words.txt"       # Text file
CHROMA_DIR  = "./chroma_db"     # ChromaDB (Persistant Storage)
COLLECTION  = "words"
MODEL_NAME  = "all-MiniLM-L6-v2"

def load_words(path: str) -> list[str]:
    with open(path, "r", encoding="utf-8") as f:
        words = [line.strip() for line in f if line.strip()]
    return words


def main():
    # 1. Load words from file
    print(f"Loading words from '{WORDS_FILE}' ...")
    words = load_words(WORDS_FILE)
    print(f"  → {len(words)} words loaded")

    # 2. Load embedding model
    print(f"\nLoading model '{MODEL_NAME}' ...")
    model = SentenceTransformer(MODEL_NAME)

    # 3. Create embeddings  (returns numpy array of shape [N, 384])
    print("\nGenerating embeddings ...")
    embeddings = model.encode(words, show_progress_bar=True).tolist()

    # 4. Connect to ChromaDB (creates the folder if it doesn't exist)
    client = chromadb.PersistentClient(path=CHROMA_DIR)

    # Delete old collection if it exists (so re-running doesn't duplicate data)
    existing = [c.name for c in client.list_collections()]
    if COLLECTION in existing:
        client.delete_collection(COLLECTION)
        print(f"\nOld collection '{COLLECTION}' deleted.")

    collection = client.create_collection(
        name=COLLECTION,
        metadata={"hnsw:space": "cosine"}   # use cosine similarity
    )

    # 5. Store words + embeddings in ChromaDB
    print("\nStoring in ChromaDB ...")
    collection.add(
        ids        = [str(i) for i in range(len(words))],
        documents  = words,       # original words stored here
        embeddings = embeddings,  # vectors stored here
    )

    print(f"\n✓ Done! {collection.count()} words stored in '{CHROMA_DIR}'")
    print("  Run search.py to start searching.\n")


if __name__ == "__main__":
    main()
