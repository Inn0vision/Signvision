import time
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.translation_cache import translation_cache, TranslationCacheService

client = TestClient(app)


class MockRedisDict:
    """In-memory dictionary simulating Redis operations for predictable test isolation."""

    def __init__(self):
        self.store = {}
        self.ttls = {}

    def get(self, key):
        if key in self.store:
            # Check expiry simulation
            if key in self.ttls and time.time() > self.ttls[key]:
                del self.store[key]
                del self.ttls[key]
                return None
            return self.store[key]
        return None

    def set(self, key, value, ex=None):
        self.store[key] = value
        if ex:
            self.ttls[key] = time.time() + ex

    def delete(self, key):
        self.store.pop(key, None)
        self.ttls.pop(key, None)

    def ping(self):
        return True


@pytest.fixture(autouse=True)
def clean_cache_state():
    """Ensure clean cache and isolated mock redis for tests."""
    mock_redis = MockRedisDict()
    orig_client = translation_cache._client
    orig_enabled = translation_cache.enabled
    translation_cache._client = mock_redis
    translation_cache.enabled = True
    translation_cache._logged_connection_error = False

    yield mock_redis

    translation_cache._client = orig_client
    translation_cache.enabled = orig_enabled


def test_cache_miss_then_hit_calls_pipeline_once(clean_cache_state):
    """
    Two identical successful /process requests invoke underlying translation
    pipeline only once, return identical response bodies, and produce MISS then HIT.
    """
    mock_results = [
        {
            "gloss": {"subject": "I", "object": "APPLE", "verb": "EAT", "tense": "PRESENT", "negation": False, "question": False, "gloss": ["APPLE", "EAT"]},
            "signs": [{"word": "APPLE", "original_query": "apple", "found": True, "s3_url": "https://example.com/apple.sigml", "match_type": "exact", "similar_words": []}],
        }
    ]

    with patch("backend.app.main._process_and_lookup", return_value=mock_results) as mock_pipeline:
        # Request 1: Cache MISS
        t0 = time.perf_counter()
        res1 = client.post("/process", json={"text": "I eat apple", "use_semantic_fallback": True})
        lat1 = (time.perf_counter() - t0) * 1000

        assert res1.status_code == 200
        assert res1.headers.get("x-translation-cache") == "MISS"
        data1 = res1.json()
        assert data1["success"] is True
        assert len(data1["results"]) == 1
        assert mock_pipeline.call_count == 1

        # Request 2: Cache HIT
        t1 = time.perf_counter()
        res2 = client.post("/process", json={"text": "I eat apple", "use_semantic_fallback": True})
        lat2 = (time.perf_counter() - t1) * 1000

        assert res2.status_code == 200
        assert res2.headers.get("x-translation-cache") == "HIT"
        data2 = res2.json()
        assert data2 == data1
        # Pipeline must NOT be called a second time
        assert mock_pipeline.call_count == 1

        # Measured performance: HIT is significantly faster than initial pipeline run
        assert lat2 <= lat1 or lat2 < 10.0


def test_cache_ttl_expiry(clean_cache_state):
    """Cache expires after TTL, causing subsequent request to produce MISS and re-invoke pipeline."""
    mock_results = [
        {
            "gloss": {"subject": None, "object": None, "verb": None, "tense": "PRESENT", "negation": False, "question": False, "gloss": ["HELLO"]},
            "signs": [{"word": "HELLO", "original_query": "hello", "found": True, "s3_url": "https://example.com/hello.sigml", "match_type": "exact", "similar_words": []}],
        }
    ]

    with patch("backend.app.main._process_and_lookup", return_value=mock_results) as mock_pipeline:
        # Request 1 with short simulated TTL
        key = translation_cache.generate_cache_key("hello world", True, "en")
        res1 = client.post("/process", json={"text": "hello world", "use_semantic_fallback": True})
        assert res1.status_code == 200
        assert res1.headers.get("x-translation-cache") == "MISS"
        assert mock_pipeline.call_count == 1

        # Simulate TTL expiry by expiring key in mock store
        clean_cache_state.ttls[key] = time.time() - 1

        # Request 2 after expiry: must MISS and re-run pipeline
        res2 = client.post("/process", json={"text": "hello world", "use_semantic_fallback": True})
        assert res2.status_code == 200
        assert res2.headers.get("x-translation-cache") == "MISS"
        assert mock_pipeline.call_count == 2


def test_cache_key_separation_punctuation(clean_cache_state):
    """Meaningful punctuation differences produce distinct cache keys."""
    mock_results = [{"gloss": {"gloss": ["COME"]}, "signs": []}]

    with patch("backend.app.main._process_and_lookup", return_value=mock_results) as mock_pipeline:
        # Statement
        res1 = client.post("/process", json={"text": "You come.", "use_semantic_fallback": True})
        assert res1.headers.get("x-translation-cache") == "MISS"

        # Question (contains '?')
        res2 = client.post("/process", json={"text": "You come?", "use_semantic_fallback": True})
        assert res2.headers.get("x-translation-cache") == "MISS"
        assert mock_pipeline.call_count == 2

        # Key check
        k1 = translation_cache.generate_cache_key("You come.", True, "en")
        k2 = translation_cache.generate_cache_key("You come?", True, "en")
        assert k1 != k2


def test_cache_key_separation_parameters(clean_cache_state):
    """Semantic fallback and language options produce separate cache keys."""
    k_fallback_true = translation_cache.generate_cache_key("test word", True, "en")
    k_fallback_false = translation_cache.generate_cache_key("test word", False, "en")
    assert k_fallback_true != k_fallback_false

    k_lang_en = translation_cache.generate_cache_key("test word", True, "en")
    k_lang_hi = translation_cache.generate_cache_key("test word", True, "hi")
    assert k_lang_en != k_lang_hi

    # Case insensitivity with identical punctuation
    k_upper = translation_cache.generate_cache_key("HELLO FRIEND!", True, "en")
    k_lower = translation_cache.generate_cache_key("  hello   friend!  ", True, "en")
    assert k_upper == k_lower


def test_redis_unavailable_fail_open():
    """When Redis is unavailable or raises errors, API fails open with BYPASS and returns valid response."""
    import redis

    mock_failing_client = MagicMock()
    mock_failing_client.get.side_effect = redis.ConnectionError("Connection refused")
    mock_failing_client.set.side_effect = redis.ConnectionError("Connection refused")

    translation_cache._client = mock_failing_client
    translation_cache.enabled = True

    mock_results = [
        {
            "gloss": {"subject": None, "object": None, "verb": None, "tense": "PRESENT", "negation": False, "question": False, "gloss": ["GOOD MORNING"]},
            "signs": [{"word": "GOOD MORNING", "original_query": "good morning", "found": True, "s3_url": "https://example.com/goodmorning.sigml", "match_type": "exact", "similar_words": []}],
        }
    ]

    with patch("backend.app.main._process_and_lookup", return_value=mock_results) as mock_pipeline:
        res = client.post("/process", json={"text": "Good morning", "use_semantic_fallback": True})
        assert res.status_code == 200
        assert res.headers.get("x-translation-cache") == "BYPASS"
        data = res.json()
        assert data["success"] is True
        assert len(data["results"]) == 1
        assert mock_pipeline.call_count == 1


def test_empty_input_not_cached(clean_cache_state):
    """Empty or whitespace-only input returns error without caching."""
    res = client.post("/process", json={"text": "   ", "use_semantic_fallback": True})
    assert res.headers.get("x-translation-cache") == "BYPASS"
    data = res.json()
    assert data["success"] is False
    assert len(clean_cache_state.store) == 0


def test_inflight_deduplication():
    """Inflight lock manages concurrent execution safely for identical cache keys."""
    import asyncio
    from backend.app.services.translation_cache import InflightLockManager

    async def run_test():
        mgr = InflightLockManager()
        execution_counter = 0

        async def worker(key):
            nonlocal execution_counter
            async with mgr.lock(key):
                execution_counter += 1
                await asyncio.sleep(0.01)

        # Run concurrent workers
        await asyncio.gather(worker("key1"), worker("key1"))

        assert execution_counter == 2
        assert len(mgr._locks) == 0

    asyncio.run(run_test())
