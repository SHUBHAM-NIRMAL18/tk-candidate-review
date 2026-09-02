import math
import time
import hashlib
import threading
from typing import Callable, Dict, Tuple, Optional
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.metrics import RATE_LIMIT_EXCEEDED_TOTAL

class TokenBucket:
    """
    Thread-safe Token Bucket implementation for rate limiting.
    Capacity represents the maximum burst size.
    Refill rate is expressed in tokens per second.
    """
    def __init__(self, capacity: float, refill_rate_per_sec: float):
        self.capacity = float(capacity)
        self.refill_rate = float(refill_rate_per_sec)
        self.tokens = float(capacity)
        self.last_refill = time.time()
        self.lock = threading.Lock()

    def consume(self, amount: float = 1.0) -> Tuple[bool, int, int, int]:
        """
        Attempts to consume `amount` tokens from the bucket.
        Returns:
            allowed (bool): True if tokens were available, False if exhausted.
            limit (int): Total bucket capacity.
            remaining (int): Remaining tokens after consumption.
            reset_seconds (int): Seconds until bucket is fully refilled (or retry duration if rejected).
        """
        with self.lock:
            now = time.time()
            elapsed = max(0.0, now - self.last_refill)
            self.last_refill = now

            # Refill tokens up to maximum capacity
            self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)

            if self.tokens >= amount:
                self.tokens -= amount
                remaining = int(math.floor(self.tokens))
                # Seconds until bucket reaches maximum capacity again
                tokens_needed = max(0.0, self.capacity - self.tokens)
                reset_seconds = max(1, int(math.ceil(tokens_needed / self.refill_rate))) if self.refill_rate > 0 else 60
                return True, int(self.capacity), remaining, reset_seconds
            else:
                # Insufficient tokens -> Calculate seconds until at least 1 token is available
                tokens_deficit = amount - self.tokens
                retry_after = max(1, int(math.ceil(tokens_deficit / self.refill_rate))) if self.refill_rate > 0 else 60
                return False, int(self.capacity), 0, retry_after

class RateLimitPolicy:
    def __init__(self, name: str, capacity: int, refill_rate_per_min: float):
        self.name = name
        self.capacity = capacity
        self.refill_rate_per_sec = refill_rate_per_min / 60.0

# Pre-defined enterprise tiers:
# Auth Tier: 10 burst capacity, refills 5/min (prevents credential stuffing/brute force)
AUTH_POLICY = RateLimitPolicy(name="auth", capacity=10, refill_rate_per_min=5.0)

# Standard Tier: 60 burst capacity, refills 60/min (1 token/sec)
STANDARD_POLICY = RateLimitPolicy(name="standard", capacity=60, refill_rate_per_min=60.0)

class RateLimiterRegistry:
    """Manages token buckets per client and cleans up idle buckets."""
    def __init__(self):
        self._buckets: Dict[str, Tuple[TokenBucket, float]] = {}
        self._lock = threading.Lock()

    def get_bucket(self, key: str, policy: RateLimitPolicy) -> TokenBucket:
        now = time.time()
        with self._lock:
            if key in self._buckets:
                bucket, _ = self._buckets[key]
                self._buckets[key] = (bucket, now)
                return bucket

            # Periodic cleanup if registry exceeds 5,000 entries
            if len(self._buckets) > 5000:
                self._prune_stale_buckets(now)

            new_bucket = TokenBucket(policy.capacity, policy.refill_rate_per_sec)
            self._buckets[key] = (new_bucket, now)
            return new_bucket

    def _prune_stale_buckets(self, now: float):
        """Removes buckets idle for more than 15 minutes to prevent memory leaks."""
        stale_keys = [k for k, (_, last_seen) in self._buckets.items() if now - last_seen > 900]
        for k in stale_keys:
            del self._buckets[k]

    def reset_for_tests(self):
        """Helper to clear buckets during test execution."""
        with self._lock:
            self._buckets.clear()

registry = RateLimiterRegistry()

def get_client_identity(request: Request) -> Tuple[str, str]:
    """
    Resolves client identifier and type:
      1. API Key header (M2M integration)
      2. Explicit Authorization Bearer token
      3. Cookie session token
      4. Client host IP (unauthenticated)
    """
    api_key = request.headers.get("x-api-key")
    if api_key and api_key.strip():
        prefix = api_key.strip()[:10]
        return f"apikey:{prefix}", "apikey"

    auth_token = None
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        auth_token = auth_header[7:].strip()
    elif request.cookies.get("access_token"):
        auth_token = request.cookies.get("access_token")

    if auth_token:
        token_digest = hashlib.sha256(auth_token.encode("utf-8")).hexdigest()[:16]
        return f"user:{token_digest}", "user"

    client_ip = request.client.host if request.client else "127.0.0.1"
    return f"ip:{client_ip}", "ip"

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Enforces token bucket rate limiting on API requests with RFC standard headers.
    Headers:
      - X-RateLimit-Limit: Maximum burst bucket capacity
      - X-RateLimit-Remaining: Tokens remaining in bucket
      - X-RateLimit-Reset: Seconds until bucket is fully refilled
      - Retry-After: Seconds until next token is available (on HTTP 429)
    """
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path

        # Exempt monitoring, docs, static, and root health check routes
        if path in ["/metrics", "/docs", "/redoc", "/openapi.json", "/favicon.ico", "/"]:
            return await call_next(request)

        # Select policy tier based on endpoint sensitivity
        if path.startswith("/api/v1/auth/login") or path.startswith("/api/v1/auth/register"):
            policy = AUTH_POLICY
        elif path.startswith("/api/"):
            policy = STANDARD_POLICY
        else:
            return await call_next(request)

        client_id, client_type = get_client_identity(request)
        bucket_key = f"{policy.name}:{client_id}"
        bucket = registry.get_bucket(bucket_key, policy)

        allowed, limit, remaining, reset_or_retry = bucket.consume(1.0)

        if not allowed:
            RATE_LIMIT_EXCEEDED_TOTAL.labels(tier=policy.name, client_type=client_type).inc()
            return JSONResponse(
                status_code=429,
                content={
                    "detail": f"Rate limit exceeded for {policy.name} tier. Please retry in {reset_or_retry} seconds."
                },
                headers={
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset_or_retry),
                    "Retry-After": str(reset_or_retry),
                }
            )

        response = await call_next(request)

        # Attach standard rate limit headers to successful responses
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_or_retry)

        return response
