import pytest
from app.metrics import (
    CANDIDATE_STATUS_UPDATES_TOTAL,
    CANDIDATE_SCORES_TOTAL,
    WEBHOOK_DISPATCHES_TOTAL,
    EXPORT_REQUESTS_TOTAL,
    ACTIVE_SSE_CONNECTIONS,
)
from tests.conftest import get_auth_headers

def test_metrics_endpoint_accessible(client):
    """Test that the /metrics endpoint returns 200 OK and valid Prometheus metric exposition format."""
    response = client.get("/metrics")
    assert response.status_code == 200
    content = response.text
    assert "http_request_duration_seconds" in content or "fastapi_inprogress_requests" in content

def test_custom_metrics_exposed_in_metrics_endpoint(client):
    """Test that custom application metrics are incremented and exposed in /metrics."""
    CANDIDATE_STATUS_UPDATES_TOTAL.labels(status="shortlisted").inc()
    CANDIDATE_SCORES_TOTAL.labels(category="technical_skills").inc()
    WEBHOOK_DISPATCHES_TOTAL.labels(event_name="candidate.status_changed", status="success").inc()
    EXPORT_REQUESTS_TOTAL.labels(format="csv").inc()
    ACTIVE_SSE_CONNECTIONS.set(3)

    response = client.get("/metrics")
    assert response.status_code == 200
    content = response.text

    assert "candidate_status_updates_total" in content
    assert 'status="shortlisted"' in content
    assert "candidate_scores_total" in content
    assert 'category="technical_skills"' in content
    assert "webhook_dispatches_total" in content
    assert "export_requests_total" in content
    assert "active_sse_connections" in content

def test_api_requests_are_instrumented(client):
    """Test that visiting standard API endpoints increments HTTP metrics."""
    headers = get_auth_headers(client, email="metricstest@techkraft.com")
    client.get("/api/v1/candidates", headers=headers)

    response = client.get("/metrics")
    assert response.status_code == 200
    content = response.text
    assert "http_requests" in content or "http_request_duration_seconds" in content
