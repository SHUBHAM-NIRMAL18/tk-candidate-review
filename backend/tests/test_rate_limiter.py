import pytest
from app.rate_limiter import registry, AUTH_POLICY, STANDARD_POLICY
from tests.conftest import get_auth_headers

@pytest.fixture(autouse=True)
def reset_rate_limit_registry():
    """Reset the in-memory token buckets before each test."""
    registry.reset_for_tests()
    yield
    registry.reset_for_tests()

def test_rate_limit_headers_on_standard_api_call(client):
    """Test that API responses include X-RateLimit-Limit, Remaining, and Reset headers."""
    headers = get_auth_headers(client, email="ratelimit1@techkraft.com")
    res = client.get("/api/v1/candidates", headers=headers)
    assert res.status_code == 200

    assert "x-ratelimit-limit" in res.headers
    assert "x-ratelimit-remaining" in res.headers
    assert "x-ratelimit-reset" in res.headers

    assert int(res.headers["x-ratelimit-limit"]) == STANDARD_POLICY.capacity
    assert int(res.headers["x-ratelimit-remaining"]) == STANDARD_POLICY.capacity - 1

def test_rate_limit_token_countdown(client):
    """Test that consecutive requests decrement the remaining token count."""
    headers = get_auth_headers(client, email="ratelimit2@techkraft.com")

    res1 = client.get("/api/v1/candidates", headers=headers)
    rem1 = int(res1.headers["x-ratelimit-remaining"])

    res2 = client.get("/api/v1/candidates", headers=headers)
    rem2 = int(res2.headers["x-ratelimit-remaining"])

    assert rem2 == rem1 - 1

def test_auth_tier_exhaustion_triggers_429(client):
    """Test that exceeding the Auth tier capacity (10 requests) returns HTTP 429 with Retry-After."""
    # Auth tier has capacity of 10 requests
    for i in range(AUTH_POLICY.capacity):
        res = client.post(
            "/api/v1/auth/login",
            json={"email": f"bruteforce_{i}@example.com", "password": "wrongpassword"}
        )
        # Should return 401 Unauthorized, not 429
        assert res.status_code == 401
        assert "x-ratelimit-remaining" in res.headers
        assert int(res.headers["x-ratelimit-limit"]) == AUTH_POLICY.capacity

    # 11th request exceeds burst capacity -> HTTP 429 Too Many Requests
    throttled_res = client.post(
        "/api/v1/auth/login",
        json={"email": "attacker@example.com", "password": "wrongpassword"}
    )
    assert throttled_res.status_code == 429
    assert "retry-after" in throttled_res.headers
    assert int(throttled_res.headers["retry-after"]) >= 1
    assert "Rate limit exceeded" in throttled_res.json()["detail"]

def test_exempt_endpoints_bypass_limiter(client):
    """Test that /metrics and docs endpoints do not consume rate limit tokens or attach headers."""
    res_metrics = client.get("/metrics")
    assert res_metrics.status_code == 200
    assert "x-ratelimit-limit" not in res_metrics.headers

    res_docs = client.get("/docs")
    assert res_docs.status_code == 200
    assert "x-ratelimit-limit" not in res_docs.headers

def test_different_clients_have_isolated_buckets(client):
    """Test that one client exhausting their quota does not throttle a different client."""
    headers_a = get_auth_headers(client, email="client_a@techkraft.com")
    headers_b = get_auth_headers(client, email="client_b@techkraft.com")

    # Client A makes requests
    res_a = client.get("/api/v1/candidates", headers=headers_a)
    assert res_a.status_code == 200
    rem_a = int(res_a.headers["x-ratelimit-remaining"])

    # Client B makes a request -> has their own fresh bucket
    res_b = client.get("/api/v1/candidates", headers=headers_b)
    assert res_b.status_code == 200
    rem_b = int(res_b.headers["x-ratelimit-remaining"])

    assert rem_b == STANDARD_POLICY.capacity - 1
