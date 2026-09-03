import pytest
from app.cache import cache
from tests.conftest import get_auth_headers

def test_candidates_list_cache_miss_then_hit(client):
    """Test that the first candidates listing query is a MISS and the second is a HIT."""
    headers = get_auth_headers(client, email="cache_user1@techkraft.com")

    # Initial query -> Cache MISS
    res1 = client.get("/api/v1/candidates", headers=headers)
    assert res1.status_code == 200
    assert res1.headers.get("x-cache-status") == "MISS"
    data1 = res1.json()

    # Immediate second query -> Cache HIT
    res2 = client.get("/api/v1/candidates", headers=headers)
    assert res2.status_code == 200
    assert res2.headers.get("x-cache-status") == "HIT"
    data2 = res2.json()

    assert data1["total"] == data2["total"]
    assert len(data1["items"]) == len(data2["items"])

def test_candidate_detail_cache_miss_then_hit(client):
    """Test that candidate detail view caches successfully."""
    headers = get_auth_headers(client, email="cache_user2@techkraft.com")

    # Create candidate
    c_res = client.post("/api/v1/candidates", json={
        "name": "Linus Torvalds",
        "email": "linus@kernel.org",
        "role_applied": "OS Architect",
        "status": "new"
    }, headers=headers)
    assert c_res.status_code == 201
    cand_id = c_res.json()["id"]

    # 1st detail fetch -> MISS
    d1 = client.get(f"/api/v1/candidates/{cand_id}", headers=headers)
    assert d1.status_code == 200
    assert d1.headers.get("x-cache-status") == "MISS"

    # 2nd detail fetch -> HIT
    d2 = client.get(f"/api/v1/candidates/{cand_id}", headers=headers)
    assert d2.status_code == 200
    assert d2.headers.get("x-cache-status") == "HIT"
    assert d2.json()["id"] == cand_id

def test_cache_invalidation_on_new_candidate_creation(client):
    """Test that creating a candidate invalidates the candidate list cache."""
    headers = get_auth_headers(client, email="cache_user3@techkraft.com")

    # Warm list cache
    client.get("/api/v1/candidates", headers=headers)
    hit_res = client.get("/api/v1/candidates", headers=headers)
    assert hit_res.headers.get("x-cache-status") == "HIT"
    count_before = hit_res.json()["total"]

    # Create new candidate -> should invalidate list cache
    create_res = client.post("/api/v1/candidates", json={
        "name": "Guido van Rossum",
        "email": "guido@python.org",
        "role_applied": "Language Designer",
        "status": "new"
    }, headers=headers)
    assert create_res.status_code == 201

    # Next list query must be a MISS and reflect the new candidate
    fresh_res = client.get("/api/v1/candidates", headers=headers)
    assert fresh_res.headers.get("x-cache-status") == "MISS"
    assert fresh_res.json()["total"] == count_before + 1

def test_cache_invalidation_on_score_submission(client):
    """Test that submitting a score invalidates both detail and list caches."""
    headers = get_auth_headers(client, email="cache_user4@techkraft.com")

    c_res = client.post("/api/v1/candidates", json={
        "name": "Ken Thompson",
        "email": "ken@bell-labs.com",
        "role_applied": "Systems Engineer",
        "status": "new"
    }, headers=headers)
    cand_id = c_res.json()["id"]

    # Warm list & detail caches
    client.get("/api/v1/candidates", headers=headers)
    client.get(f"/api/v1/candidates/{cand_id}", headers=headers)

    assert client.get(f"/api/v1/candidates/{cand_id}", headers=headers).headers.get("x-cache-status") == "HIT"
    assert client.get("/api/v1/candidates", headers=headers).headers.get("x-cache-status") == "HIT"

    # Submit score -> should invalidate detail and list caches
    score_res = client.post(f"/api/v1/candidates/{cand_id}/scores", json={
        "category": "Unix Philosophy",
        "score": 5,
        "note": "Pioneer"
    }, headers=headers)
    assert score_res.status_code == 201

    # Detail cache must be invalidated (MISS) and reflect new score
    d_fresh = client.get(f"/api/v1/candidates/{cand_id}", headers=headers)
    assert d_fresh.headers.get("x-cache-status") == "MISS"
    assert len(d_fresh.json()["scores"]) == 1

    # List cache must be invalidated (MISS) and reflect new average score
    l_fresh = client.get("/api/v1/candidates", headers=headers)
    assert l_fresh.headers.get("x-cache-status") == "MISS"

def test_cache_invalidation_on_update_and_delete(client, db_session):
    """Test that admin candidate update and delete invalidate caches."""
    from app.models.user import User
    from app.auth import hash_password

    # Setup admin user
    admin_user = User(
        email="admin_cache@techkraft.com",
        hashed_password=hash_password("adminpass123"),
        role="admin"
    )
    db_session.add(admin_user)
    db_session.commit()

    login_res = client.post("/api/v1/auth/login", json={"email": "admin_cache@techkraft.com", "password": "adminpass123"})
    token = login_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {token}"}

    c_res = client.post("/api/v1/candidates", json={
        "name": "Dennis Ritchie",
        "email": "dennis@bell-labs.com",
        "role_applied": "C Architect",
        "status": "new"
    }, headers=admin_headers)
    cand_id = c_res.json()["id"]

    # Warm detail cache
    client.get(f"/api/v1/candidates/{cand_id}", headers=admin_headers)
    assert client.get(f"/api/v1/candidates/{cand_id}", headers=admin_headers).headers.get("x-cache-status") == "HIT"

    # Update candidate -> invalidates cache
    patch_res = client.patch(f"/api/v1/candidates/{cand_id}", json={"role_applied": "C & Unix Architect"}, headers=admin_headers)
    assert patch_res.status_code == 200

    d_after_patch = client.get(f"/api/v1/candidates/{cand_id}", headers=admin_headers)
    assert d_after_patch.headers.get("x-cache-status") == "MISS"
    assert d_after_patch.json()["role_applied"] == "C & Unix Architect"

    # Warm detail again
    assert client.get(f"/api/v1/candidates/{cand_id}", headers=admin_headers).headers.get("x-cache-status") == "HIT"

    # Delete (soft delete) candidate -> invalidates cache
    del_res = client.delete(f"/api/v1/candidates/{cand_id}", headers=admin_headers)
    assert del_res.status_code == 200

    d_after_del = client.get(f"/api/v1/candidates/{cand_id}", headers=admin_headers)
    assert d_after_del.headers.get("x-cache-status") == "MISS"
    assert d_after_del.json()["status"] == "archived"

def test_cache_graceful_fallback_when_redis_disabled():
    """Test that CacheManager in-memory fallback works seamlessly when Redis is bypassed."""
    cache._redis_disabled = True
    try:
        key = "test:fallback:key"
        val = {"message": "fallback working", "number": 42}
        
        assert cache.set(key, val, ttl=10) is True
        fetched = cache.get(key)
        assert fetched == val
        
        cache.delete(key)
        assert cache.get(key) is None
    finally:
        cache._redis_disabled = False
