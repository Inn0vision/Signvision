import re
import json
import asyncio
import hashlib
import logging
from typing import Optional, Dict, Any, Tuple
from contextlib import asynccontextmanager

import redis
from ..core.config import settings

logger = logging.getLogger("translation_cache")


class InflightLockManager:
    """Lightweight in-memory mutex manager to avoid duplicate concurrent processing of identical keys."""

    def __init__(self):
        self._locks: Dict[str, asyncio.Lock] = {}
        self._counts: Dict[str, int] = {}
        self._guard = asyncio.Lock()

    @asynccontextmanager
    async def lock(self, key: str):
        async with self._guard:
            if key not in self._locks:
                self._locks[key] = asyncio.Lock()
                self._counts[key] = 0
            self._counts[key] += 1
            key_lock = self._locks[key]

        async with key_lock:
            try:
                yield
            finally:
                async with self._guard:
                    self._counts[key] -= 1
                    if self._counts[key] <= 0:
                        self._locks.pop(key, None)
                        self._counts.pop(key, None)


class TranslationCacheService:
    """Production-conscious Redis cache service for SignVision sentence translation."""

    def __init__(
        self,
        redis_url: Optional[str] = None,
        enabled: Optional[bool] = None,
        ttl: Optional[int] = None,
        version: Optional[str] = None,
    ):
        self.redis_url = redis_url or settings.REDIS_URL
        self.enabled = enabled if enabled is not None else settings.REDIS_CACHE_ENABLED
        self.ttl = ttl if ttl is not None else settings.REDIS_CACHE_TTL
        self.version = version or settings.TRANSLATION_CACHE_VERSION

        self._pool: Optional[redis.ConnectionPool] = None
        self._client: Optional[redis.Redis] = None
        self._logged_connection_error = False
        self.inflight = InflightLockManager()

    def connect(self) -> None:
        """Initialize Redis connection pool with short fail-open connection timeouts."""
        if not self.enabled:
            return

        try:
            self._pool = redis.ConnectionPool.from_url(
                self.redis_url,
                max_connections=20,
                socket_connect_timeout=0.5,
                socket_timeout=0.5,
                decode_responses=True,
            )
            self._client = redis.Redis(connection_pool=self._pool)
        except Exception as e:
            self._handle_error(e)

    def close(self) -> None:
        """Safely close Redis connection pool during application shutdown."""
        if self._pool:
            try:
                self._pool.disconnect()
            except Exception:
                pass
            self._pool = None
            self._client = None

    def generate_cache_key(
        self,
        text: str,
        use_semantic_fallback: bool = True,
        language: str = "en",
        model: Optional[str] = None,
    ) -> str:
        """
        Generate a deterministic, collision-resistant cache key.
        Preserves meaningful punctuation while normalizing case and whitespace.
        """
        norm_text = re.sub(r"\s+", " ", (text or "").strip()).lower()
        norm_lang = (language or "en").strip().lower()
        active_model = model or settings.GROQ_MODEL

        raw_payload = (
            f"v={self.version}|"
            f"m={active_model}|"
            f"fb={int(use_semantic_fallback)}|"
            f"lang={norm_lang}|"
            f"text={norm_text}"
        )
        digest = hashlib.sha256(raw_payload.encode("utf-8")).hexdigest()
        return f"signvision:trans:{self.version}:{digest}"

    def get(self, key: str) -> Tuple[Optional[Dict[str, Any]], str]:
        """
        Fetch cached translation response.
        Returns (data, "HIT"), (None, "MISS"), or (None, "BYPASS").
        """
        if not self.enabled:
            return None, "BYPASS"

        if not self._client:
            self.connect()
            if not self._client:
                return None, "BYPASS"

        try:
            raw = self._client.get(key)
            if raw:
                self._on_success()
                return json.loads(raw), "HIT"
            self._on_success()
            return None, "MISS"
        except (redis.ConnectionError, redis.TimeoutError, redis.RedisError) as e:
            self._handle_error(e)
            return None, "BYPASS"
        except Exception as e:
            logger.warning("Translation cache deserialization failed: %s", type(e).__name__)
            return None, "MISS"

    def set(
        self,
        key: str,
        data: Dict[str, Any],
        ttl: Optional[int] = None,
    ) -> bool:
        """
        Cache complete, successful response.
        Refuses to cache failed, empty, or invalid results.
        """
        if not self.enabled:
            return False

        if not isinstance(data, dict) or not data.get("success") or not data.get("results"):
            return False

        if not self._client:
            self.connect()
            if not self._client:
                return False

        try:
            payload = json.dumps(data)
            effective_ttl = ttl if ttl is not None else self.ttl
            self._client.set(key, payload, ex=effective_ttl)
            self._on_success()
            return True
        except (redis.ConnectionError, redis.TimeoutError, redis.RedisError) as e:
            self._handle_error(e)
            return False

    def _handle_error(self, err: Exception) -> None:
        """Fail open without spamming logs repeatedly for the same connection failure."""
        if not self._logged_connection_error:
            logger.warning(
                "Redis translation cache unavailable, failing open: %s",
                type(err).__name__,
            )
            self._logged_connection_error = True

    def _on_success(self) -> None:
        """Reset connection failure log flag once Redis connection succeeds."""
        if self._logged_connection_error:
            logger.info("Redis translation cache connection restored.")
            self._logged_connection_error = False


# Global singleton instance
translation_cache = TranslationCacheService()
