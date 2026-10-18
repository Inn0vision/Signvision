import os
from pathlib import Path
try:
    from pydantic_settings import BaseSettings
except ImportError:
    try:
        from pydantic import BaseSettings  # pydantic v1
    except ImportError:
        from pydantic import BaseModel

        class BaseSettings(BaseModel):
            def __init__(self, **data):
                # Pull from environment variables if present
                init_data = {}
                env_file_path = Path(__file__).resolve().parent.parent.parent.parent / ".env"
                if env_file_path.exists():
                    try:
                        with open(env_file_path, "r", encoding="utf-8") as f:
                            for line in f:
                                line = line.strip()
                                if line and not line.startswith("#") and "=" in line:
                                    k, v = line.split("=", 1)
                                    init_data[k.strip()] = v.strip().strip("'\"")
                    except Exception:
                        pass
                for k, v in os.environ.items():
                    init_data[k] = v
                init_data.update(data)
                super().__init__(**init_data)

            class Config:
                extra = "ignore"
from functools import lru_cache


class Settings(BaseSettings):
    GROQ_API_KEY: str = ""
    GROQ_API_KEY_FALLBACK_1: str = ""
    GROQ_API_KEY_FALLBACK_2: str = ""
    GROQ_API_KEY_FALLBACK_3: str = ""
    GROQ_API_KEYS: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-20b"

    def get_groq_api_keys(self) -> list[str]:
        """Collect and deduplicate all configured primary and fallback Groq API keys."""
        keys: list[str] = []
        if self.GROQ_API_KEYS:
            for k in self.GROQ_API_KEYS.split(","):
                k = k.strip()
                if k and k not in keys:
                    keys.append(k)

        for candidate in [
            self.GROQ_API_KEY,
            self.GROQ_API_KEY_FALLBACK_1,
            self.GROQ_API_KEY_FALLBACK_2,
            self.GROQ_API_KEY_FALLBACK_3,
        ]:
            candidate = candidate.strip() if candidate else ""
            if candidate and candidate not in keys:
                keys.append(candidate)

        for env_k, env_v in os.environ.items():
            if env_k.startswith("GROQ_API_KEY") and env_v.strip() and env_v.strip() not in keys:
                keys.append(env_v.strip())

        return keys

    DATA_DIR: Path = Path(__file__).resolve().parent.parent.parent / "data"
    SIGN_LANGUAGE_DATA_FILE: str = "sign_language_data.json"
    WORDS_FILE: str = "words.txt"

    CHROMA_DB_PATH: str = str((Path(__file__).resolve().parent.parent.parent / "data" / "chroma_db").resolve())
    CHROMA_COLLECTION: str = "words"
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    SEMANTIC_SEARCH_TOP_K: int = 5
    SEMANTIC_SEARCH_MIN_SIMILARITY: float = 0.65

    RECORDINGS_DIR: str = "./recordings"

    REDIS_URL: str = "redis://127.0.0.1:6379/0"
    REDIS_CACHE_ENABLED: bool = True
    REDIS_CACHE_TTL: int = 604800  # 7 days
    TRANSLATION_CACHE_VERSION: str = "v1"

    class Config:
        env_file = str(Path(__file__).resolve().parent.parent.parent.parent / ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
