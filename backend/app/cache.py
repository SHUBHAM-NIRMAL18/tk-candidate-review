import os
import json
import time
import fnmatch
import logging
import threading
from typing import Any, Optional, Dict, Tuple

try:
    import redis
except ImportError:
    redis = None

from app.metrics import CACHE_OPERATIONS_TOTAL

logger = logging.getLogger(__name__)

class CacheManager:
    """
    Production Redis Cache Manager with Graceful Degradation.
    Provides sub-second caching with non-blocking pattern invalidation (scan_iter).
    Falls back to a thread-safe in-memory TTL dictionary if Redis is offline.
    """
    def __init__(self):
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self._redis_client: Optional[Any] = None
        self._memory_cache: Dict[str, Tuple[str, float]] = {}
        self._lock = threading.Lock()
        self._redis_disabled = False
        self._init_redis()

    def _init_redis(self):
        if redis is None:
            logger.warning("Redis library not installed, using in-memory cache fallback.")
            return

        try:
            self._redis_client = redis.Redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_timeout=0.5,
                socket_connect_timeout=0.5
            )
            # Test ping
            self._redis_client.ping()
            logger.info("Connected to Redis at %s", self.redis_url)
        except Exception as exc:
            logger.warning("Redis unavailable (%s), falling back to in-memory caching.", exc)
            self._redis_client = None

    def get(self, key: str) -> Optional[Any]:
        """Fetches and deserializes cached JSON object by key."""
        # 1. Try Redis
        if self._redis_client is not None and not self._redis_disabled:
            try:
                raw = self._redis_client.get(key)
                if raw is not None:
                    CACHE_OPERATIONS_TOTAL.labels(operation="get", status="hit").inc()
                    return json.loads(raw)
                else:
                    CACHE_OPERATIONS_TOTAL.labels(operation="get", status="miss").inc()
                    return None
            except Exception as exc:
                logger.debug("Redis GET error (%s), attempting memory cache.", exc)
                CACHE_OPERATIONS_TOTAL.labels(operation="get", status="error").inc()

        # 2. Fallback to in-memory TTL cache
        now = time.time()
        with self._lock:
            if key in self._memory_cache:
                raw, expires_at = self._memory_cache[key]
                if now < expires_at:
                    CACHE_OPERATIONS_TOTAL.labels(operation="get", status="hit").inc()
                    return json.loads(raw)
                else:
                    del self._memory_cache[key]

        CACHE_OPERATIONS_TOTAL.labels(operation="get", status="miss").inc()
        return None

    def set(self, key: str, value: Any, ttl: int = 60) -> bool:
        """Serializes and stores value with TTL in seconds."""
        try:
            raw = json.dumps(value, default=str)
        except Exception as exc:
            logger.error("Failed to serialize cache value for key %s: %s", key, exc)
            return False

        # 1. Store in Redis
        stored_redis = False
        if self._redis_client is not None and not self._redis_disabled:
            try:
                self._redis_client.set(key, raw, ex=ttl)
                stored_redis = True
            except Exception as exc:
                logger.debug("Redis SET error (%s), using memory cache.", exc)

        # 2. Store in Memory Cache (for resilience)
        now = time.time()
        with self._lock:
            self._memory_cache[key] = (raw, now + ttl)

        CACHE_OPERATIONS_TOTAL.labels(operation="set", status="success").inc()
        return True

    def delete(self, key: str) -> bool:
        """Deletes a specific key from cache."""
        if self._redis_client is not None and not self._redis_disabled:
            try:
                self._redis_client.delete(key)
            except Exception:
                pass

        with self._lock:
            self._memory_cache.pop(key, None)

        CACHE_OPERATIONS_TOTAL.labels(operation="invalidate", status="success").inc()
        return True

    def delete_pattern(self, pattern: str) -> int:
        """
        Invalidates all keys matching a glob pattern (e.g. 'candidates:list:*').
        Uses non-blocking SCAN in Redis rather than blocking KEYS command.
        """
        count = 0
        if self._redis_client is not None and not self._redis_disabled:
            try:
                keys_to_delete = []
                for key in self._redis_client.scan_iter(match=pattern, count=100):
                    keys_to_delete.append(key)
                if keys_to_delete:
                    self._redis_client.delete(*keys_to_delete)
                    count += len(keys_to_delete)
            except Exception as exc:
                logger.debug("Redis scan/delete error: %s", exc)

        with self._lock:
            matching_keys = [k for k in self._memory_cache if fnmatch.fnmatch(k, pattern)]
            for k in matching_keys:
                del self._memory_cache[k]
                count += 1

        CACHE_OPERATIONS_TOTAL.labels(operation="invalidate", status="success").inc()
        return count

    def clear(self):
        """Clears all cached entries (useful for test fixtures)."""
        if self._redis_client is not None and not self._redis_disabled:
            try:
                self._redis_client.flushdb()
            except Exception:
                pass
        with self._lock:
            self._memory_cache.clear()

cache = CacheManager()

def make_candidates_list_key(
    role: str,
    status_filter: Optional[str] = None,
    role_applied: Optional[str] = None,
    skill: Optional[str] = None,
    keyword: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = None,
    page: int = 1,
    page_size: int = 20
) -> str:
    """Generates deterministic cache key for candidate listing queries."""
    parts = [
        f"role={role}",
        f"st={status_filter or 'all'}",
        f"ra={role_applied or 'all'}",
        f"sk={skill or 'all'}",
        f"kw={keyword or 'none'}",
        f"sort={sort_by or 'created_at'}_{sort_order or 'desc'}",
        f"p={page}",
        f"sz={page_size}"
    ]
    return f"candidates:list:{':'.join(parts)}"

def make_candidate_detail_key(role: str, user_id: str, candidate_id: str) -> str:
    """Generates deterministic cache key for candidate detail query."""
    if role == "admin":
        return f"candidates:detail:role=admin:cid={candidate_id}"
    return f"candidates:detail:role=reviewer:uid={user_id}:cid={candidate_id}"

def invalidate_candidate_caches(candidate_id: Optional[str] = None):
    """
    Surgically invalidates candidate caches:
      - Always invalidates all candidate listing queries (candidates:list:*)
      - If candidate_id is specified, invalidates all detail caches for that candidate
    """
    # Invalidate all candidate list query combinations
    cache.delete_pattern("candidates:list:*")

    # Invalidate detail query for the candidate
    if candidate_id:
        cache.delete_pattern(f"candidates:detail:*:cid={candidate_id}")
