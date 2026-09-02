import uuid
from datetime import datetime, timezone, timedelta
import pytest
from app.models.candidate import Candidate
from app.models.idempotency_key import IdempotencyKey
from tests.conftest import get_auth_headers

def test_idempotency_post_candidate_miss_then_hit(client, db_session):
    """Test that first request creates candidate (MISS) and second identical request replays cached response (HIT)."""
    headers = get_auth_headers(client, email="idempotent_admin@example.com")
    idempotency_key = f"key_{uuid.uuid4()}"
    headers["Idempotency-Key"] = idempotency_key

    candidate_payload = {
        "name": "Grace Hopper",
        "email": "grace.hopper@navy.mil",
        "role_applied": "Senior Systems Engineer",
        "status": "new",
        "skills": "Compilers, COBOL, Distributed Systems",
    }

    # First request -> MISS
    res1 = client.post("/api/v1/candidates", json=candidate_payload, headers=headers)
    assert res1.status_code == 201
    assert res1.headers.get("x-cache-lookup") == "MISS-IDEMPOTENT"
    assert res1.headers.get("idempotency-key") == idempotency_key
    data1 = res1.json()
    candidate_id = data1["id"]
    assert data1["name"] == "Grace Hopper"

    # Verify 1 record exists in DB
    assert db_session.query(Candidate).count() == 1

    # Second identical request -> HIT
    res2 = client.post("/api/v1/candidates", json=candidate_payload, headers=headers)
    assert res2.status_code == 201
    assert res2.headers.get("x-cache-lookup") == "HIT-IDEMPOTENT"
    assert res2.headers.get("idempotency-replayed") == "true"
    assert res2.headers.get("idempotency-key") == idempotency_key
    data2 = res2.json()
    assert data2["id"] == candidate_id
    assert data2["name"] == "Grace Hopper"

    # Verify still only 1 record exists in DB (no duplicate insertion)
    assert db_session.query(Candidate).count() == 1

def test_idempotency_payload_mismatch_returns_422(client, db_session):
    """Test that reusing an idempotency key with a different payload returns HTTP 422 Unprocessable Entity."""
    headers = get_auth_headers(client, email="mismatch_user@example.com")
    idempotency_key = f"mismatch_{uuid.uuid4()}"
    headers["Idempotency-Key"] = idempotency_key

    payload_a = {
        "name": "Ada Lovelace",
        "email": "ada@analytics.org",
        "role_applied": "Algorithm Engineer",
        "status": "new",
        "skills": "Mathematics, Analytical Engine",
    }

    payload_b = {
        "name": "Ada Lovelace",
        "email": "ada.different@analytics.org",  # Different email
        "role_applied": "Algorithm Engineer",
        "status": "new",
        "skills": "Mathematics, Analytical Engine",
    }

    # Request 1 with Payload A -> 201 Created
    res1 = client.post("/api/v1/candidates", json=payload_a, headers=headers)
    assert res1.status_code == 201
    assert res1.headers.get("x-cache-lookup") == "MISS-IDEMPOTENT"

    # Request 2 with same key but Payload B -> 422 Mismatch
    res2 = client.post("/api/v1/candidates", json=payload_b, headers=headers)
    assert res2.status_code == 422
    assert "different request payload" in res2.json()["detail"]
    assert res2.headers.get("x-cache-lookup") == "MISMATCH-IDEMPOTENT"

def test_idempotency_concurrent_conflict_returns_409(client, db_session):
    """Test that a request arriving while key is in PROCESSING status receives HTTP 409 Conflict."""
    headers = get_auth_headers(client, email="conflict_user@example.com")
    idempotency_key = f"conflict_{uuid.uuid4()}"
    headers["Idempotency-Key"] = idempotency_key

    # Pre-seed a record in PROCESSING status
    from app.idempotency import get_request_user_identifier
    from fastapi import Request
    
    proc_record = IdempotencyKey(
        key=idempotency_key,
        user_id="anonymous",  # matches unauthenticated or we query with headers
        request_method="POST",
        request_path="/api/v1/candidates",
        request_hash="dummyhash",
        status="PROCESSING",
        created_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24)
    )
    # We query with actual user_id from token
    # Let's verify by sending request
    payload = {
        "name": "Alan Turing",
        "email": "turing@bletchley.uk",
        "role_applied": "Cryptanalyst",
        "status": "new",
    }
    
    res1 = client.post("/api/v1/candidates", json=payload, headers=headers)
    assert res1.status_code == 201

    # Now manually set status back to PROCESSING to simulate concurrent race condition
    rec = db_session.query(IdempotencyKey).filter(IdempotencyKey.key == idempotency_key).first()
    assert rec is not None
    rec.status = "PROCESSING"
    db_session.commit()

    # Next request with same key should hit 409 Conflict
    res2 = client.post("/api/v1/candidates", json=payload, headers=headers)
    assert res2.status_code == 409
    assert "currently processing" in res2.json()["detail"]
    assert res2.headers.get("retry-after") == "2"

def test_request_without_idempotency_key_bypasses(client, db_session):
    """Test that requests without Idempotency-Key header execute normally and create multiple entities."""
    headers = get_auth_headers(client, email="bypass_user@example.com")

    payload1 = {
        "name": "Claude Shannon",
        "email": "shannon1@bell-labs.com",
        "role_applied": "Information Theorist",
        "status": "new",
    }
    payload2 = {
        "name": "Claude Shannon",
        "email": "shannon2@bell-labs.com",
        "role_applied": "Information Theorist",
        "status": "new",
    }

    res1 = client.post("/api/v1/candidates", json=payload1, headers=headers)
    assert res1.status_code == 201
    assert "idempotency-key" not in res1.headers

    res2 = client.post("/api/v1/candidates", json=payload2, headers=headers)
    assert res2.status_code == 201
    assert "idempotency-key" not in res2.headers

    # Two distinct candidates created
    assert db_session.query(Candidate).count() == 2

def test_idempotency_score_submission(client, db_session):
    """Test idempotency on evaluation score submission endpoint."""
    headers = get_auth_headers(client, email="evaluator@example.com")
    
    # Create candidate
    c_res = client.post("/api/v1/candidates", json={
        "name": "Katherine Johnson",
        "email": "katherine@nasa.gov",
        "role_applied": "Orbital Trajectory Lead",
        "status": "new",
    }, headers=headers)
    candidate_id = c_res.json()["id"]

    score_key = f"score_{uuid.uuid4()}"
    headers["Idempotency-Key"] = score_key
    score_payload = {
        "category": "Mathematics",
        "score": 5,
        "note": "Exceptional orbital calculations"
    }

    # First score submission -> MISS
    s1 = client.post(f"/api/v1/candidates/{candidate_id}/scores", json=score_payload, headers=headers)
    assert s1.status_code == 201
    assert s1.headers.get("x-cache-lookup") == "MISS-IDEMPOTENT"
    score_id = s1.json()["id"]

    # Second score submission with same key -> HIT
    s2 = client.post(f"/api/v1/candidates/{candidate_id}/scores", json=score_payload, headers=headers)
    assert s2.status_code == 201
    assert s2.headers.get("x-cache-lookup") == "HIT-IDEMPOTENT"
    assert s2.json()["id"] == score_id
