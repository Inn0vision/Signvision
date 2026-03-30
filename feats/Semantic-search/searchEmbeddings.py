from sentence_transformers import SentenceTransformer
import chromadb

# ── Config ────────────────────────────────────────────────────────────────────
CHROMA_DIR       = "./chroma_db"    # must match what embed.py used
COLLECTION       = "words"
MODEL_NAME       = "all-MiniLM-L6-v2"
DEFAULT_TOP_K    = 5
MIN_SIMILARITY   = 0.5              # results below this score are hidden
# ─────────────────────────────────────────────────────────────────────────────

def load_resources():
    """Load model + ChromaDB collection once at startup."""
    model      = SentenceTransformer(MODEL_NAME)
    client     = chromadb.PersistentClient(path=CHROMA_DIR)
    collection = client.get_collection(COLLECTION)
    return model, collection


def search(query: str, model, collection, top_k: int = DEFAULT_TOP_K):
    """
    Embed the query and return the top_k most similar words.

    Returns a list of (word, similarity_score) tuples,
    filtered by MIN_SIMILARITY, sorted best-first.
    """
    # Embed the query
    vec = model.encode([query]).tolist()

    # Query ChromaDB
    results = collection.query(
        query_embeddings = vec,
        n_results        = top_k,
    )

    words     = results["documents"][0]
    distances = results["distances"][0]   # cosine distance: 0 = identical

    # Convert distance → similarity score and filter weak matches
    output = [
        (word, round(1 - dist, 4))
        for word, dist in zip(words, distances)
        if (1 - dist) >= MIN_SIMILARITY
    ]

    return output   # [(word, score), ...]


def print_results(query: str, results: list):
    print(f"\nQuery : '{query}'")
    print(f"{'─' * 30}")
    if not results:
        print("  No similar words found.")
    else:
        for rank, (word, score) in enumerate(results, 1):
            bar = "█" * int(score * 20)   # visual score bar
            print(f"  {rank}. {word:<20} {score:.4f}  {bar}")
    print()


def main():
    print("Loading model and database ...")
    model, collection = load_resources()
    total = collection.count()
    print(f"✓ Ready — {total} words in database\n")

    # ── Interactive loop ───────────────────────────────────────────────────
    print("Type a word to search for similar words.")
    print("Commands:  :q  quit  |  :k <number>  change top-k  |  :min <0-1>  change threshold\n")

    global DEFAULT_TOP_K, MIN_SIMILARITY
    top_k = DEFAULT_TOP_K

    while True:
        try:
            user_input = input("Search > ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye!")
            break

        if not user_input:
            continue

        # ── Commands ──────────────────────────────────────────────────────
        if user_input == ":q":
            print("Bye!")
            break

        if user_input.startswith(":k "):
            try:
                top_k = int(user_input.split()[1])
                print(f"  top-k set to {top_k}")
            except ValueError:
                print("  Usage: :k <number>")
            continue

        if user_input.startswith(":min "):
            try:
                MIN_SIMILARITY = float(user_input.split()[1])
                print(f"  Min similarity set to {MIN_SIMILARITY}")
            except ValueError:
                print("  Usage: :min <0.0 – 1.0>")
            continue

        # ── Normal search ─────────────────────────────────────────────────
        results = search(user_input, model, collection, top_k=top_k)
        print_results(user_input, results)


if __name__ == "__main__":
    main()
