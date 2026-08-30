import time
from typing import Callable
from fastapi import FastAPI, Request, Response
from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    generate_latest,
    CONTENT_TYPE_LATEST,
    REGISTRY,
)
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.routing import Match

# Standard HTTP Request Metrics
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

# Custom Business & Application Metrics
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

        FASTAPI_INPROGRESS_REQUESTS.labels(method=method, handler=route_path).inc()
        start_time = time.time()
        status_code = 500

        try:
            response = await call_next(request)
            status_code = response.status_code
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
