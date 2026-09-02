import sys
import time
from typing import Callable
from fastapi import FastAPI, Request, Response
from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    Info,
    generate_latest,
    CONTENT_TYPE_LATEST,
    REGISTRY,
)
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.routing import Match

# ── Application Info Gauge ───────────────────────────────────────────────
# Exposes service metadata as labels. Standard practice for service discovery
# and version-aware dashboards (e.g. canary vs stable rollout tracking).
APP_INFO = Info(
    "app",
    "Application metadata for service discovery and version tracking",
)
APP_INFO.info({
    "name": "tk-candidate-review",
    "version": "1.0.0",
    "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
    "framework": "fastapi",
})

# ── Standard HTTP Request Metrics ────────────────────────────────────────
HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total count of HTTP requests processed by status, method, and path",
    ["method", "handler", "status"],
)

HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "handler", "status"],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 10.0],
)

FASTAPI_INPROGRESS_REQUESTS = Gauge(
    "fastapi_inprogress_requests",
    "Number of HTTP requests currently being processed",
    ["method", "handler"],
)

# ── Request & Response Size Metrics ──────────────────────────────────────
# Tracks payload sizes to detect oversized requests (potential abuse),
# response bloat, and verify pagination is working as expected.
HTTP_REQUEST_SIZE_BYTES = Histogram(
    "http_request_size_bytes",
    "HTTP request body size in bytes",
    ["method", "handler"],
    buckets=[64, 256, 1024, 4096, 16384, 65536, 262144, 1048576],
)

HTTP_RESPONSE_SIZE_BYTES = Histogram(
    "http_response_size_bytes",
    "HTTP response body size in bytes",
    ["method", "handler"],
    buckets=[64, 256, 1024, 4096, 16384, 65536, 262144, 1048576],
)

# ── Database Query Metrics ───────────────────────────────────────────────
# Tracks query latency — the #1 bottleneck in CRUD applications.
# Enables alerting on slow queries and trending DB performance over time.
DB_QUERY_DURATION_SECONDS = Histogram(
    "db_query_duration_seconds",
    "Database query execution duration in seconds",
    ["operation"],  # e.g. list_candidates, get_candidate, create_score
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)

# ── Authentication & Security Metrics ────────────────────────────────────
# Tracks login attempts by result — enables brute-force detection alerts
# and login success/failure ratio dashboards.
AUTH_LOGIN_ATTEMPTS_TOTAL = Counter(
    "auth_login_attempts_total",
    "Total login attempts by result (success or failure)",
    ["result"],  # success, failure
)

AUTH_ACTIVE_SESSIONS = Gauge(
    "auth_active_sessions",
    "Approximate number of currently active authenticated sessions",
)

# ── Custom Business & Application Metrics ────────────────────────────────
CANDIDATE_STATUS_UPDATES_TOTAL = Counter(
    "candidate_status_updates_total",
    "Total number of candidate status changes",
    ["status"],
)

CANDIDATE_SCORES_TOTAL = Counter(
    "candidate_scores_total",
    "Total number of candidate scores submitted",
    ["category"],
)

WEBHOOK_DISPATCHES_TOTAL = Counter(
    "webhook_dispatches_total",
    "Total number of webhook events dispatched",
    ["event_name", "status"],  # status: success, failed
)

EXPORT_REQUESTS_TOTAL = Counter(
    "export_requests_total",
    "Total number of export file requests",
    ["format"],  # csv, json
)

ACTIVE_SSE_CONNECTIONS = Gauge(
    "active_sse_connections",
    "Number of currently active SSE stream subscribers",
)

# ── Idempotency Metrics ──────────────────────────────────────────────────
# Tracks idempotency outcomes on mutating API calls (replay hits, fresh misses,
# payload mismatch rejections, and concurrent request conflicts).
IDEMPOTENCY_OPERATIONS_TOTAL = Counter(
    "idempotency_operations_total",
    "Total count of idempotency key evaluation outcomes",
    ["result"],  # hit, miss, mismatch, conflict, bypass
)

# ── Rate Limiting Metrics ────────────────────────────────────────────────
# Tracks rate limiting throttles across policy tiers (auth vs standard)
# and client authentication types (user, apikey, ip).
RATE_LIMIT_EXCEEDED_TOTAL = Counter(
    "rate_limit_exceeded_total",
    "Total number of HTTP requests rejected due to rate limit exhaustion",
    ["tier", "client_type"],
)

def get_route_path(request: Request) -> str:
    """Finds the matched route path template (e.g. /api/v1/candidates/{id}) to avoid metric label explosion."""
    if hasattr(request, "app") and hasattr(request.app, "routes"):
        for route in request.app.routes:
            match, _ = route.matches(request.scope)
            if match == Match.FULL:
                return getattr(route, "path", request.url.path)
    return request.url.path

class PrometheusMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        if path in ["/metrics", "/docs", "/redoc", "/openapi.json", "/favicon.ico"]:
            return await call_next(request)

        method = request.method
        route_path = get_route_path(request)

        # Track request body size
        request_size = 0
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                request_size = int(content_length)
            except (ValueError, TypeError):
                pass
        HTTP_REQUEST_SIZE_BYTES.labels(method=method, handler=route_path).observe(request_size)

        FASTAPI_INPROGRESS_REQUESTS.labels(method=method, handler=route_path).inc()
        start_time = time.time()
        status_code = 500

        try:
            response = await call_next(request)
            status_code = response.status_code

            # Track response body size
            response_size = 0
            response_content_length = response.headers.get("content-length")
            if response_content_length:
                try:
                    response_size = int(response_content_length)
                except (ValueError, TypeError):
                    pass
            HTTP_RESPONSE_SIZE_BYTES.labels(method=method, handler=route_path).observe(response_size)

            return response
        except Exception:
            raise
        finally:
            duration = max(time.time() - start_time, 0.0)
            status_str = str(status_code)
            HTTP_REQUEST_DURATION_SECONDS.labels(
                method=method, handler=route_path, status=status_str
            ).observe(duration)
            HTTP_REQUESTS_TOTAL.labels(
                method=method, handler=route_path, status=status_str
            ).inc()
            FASTAPI_INPROGRESS_REQUESTS.labels(method=method, handler=route_path).dec()

def metrics_endpoint(request: Request) -> Response:
    """Exposes Prometheus exposition format metrics."""
    return Response(content=generate_latest(REGISTRY), media_type=CONTENT_TYPE_LATEST)

def setup_metrics(app: FastAPI) -> None:
    """Instruments FastAPI application and exposes Prometheus /metrics endpoint."""
    app.add_middleware(PrometheusMiddleware)
    app.add_route("/metrics", metrics_endpoint, methods=["GET"], include_in_schema=True)
