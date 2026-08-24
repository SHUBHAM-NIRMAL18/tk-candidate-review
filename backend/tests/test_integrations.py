import hashlib
import hmac
import pytest
from app.models.user import User
from app.auth import hash_password
from app.services.webhook_service import compute_hmac_signature

def get_admin_headers(client, db_session):
    admin_user = User(
        email="admin_test@techkraft.com",
        hashed_password=hash_password("adminpass12345"),
        role="admin"
    )
    db_session.add(admin_user)
    db_session.commit()
    db_session.refresh(admin_user)

    res = client.post("/api/v1/auth/login", json={"email": "admin_test@techkraft.com", "password": "adminpass12345"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_api_key_lifecycle_and_m2m_auth(client, db_session):
    admin_headers = get_admin_headers(client, db_session)

    # 1. Create API key
    create_res = client.post(
        "/api/v1/integrations/api-keys",
        headers=admin_headers,
        json={
            "name": "GitHub Actions CI Key",
            "scopes": ["candidates:read", "candidates:write", "scores:read", "scores:write"],
            "expires_in_days": 30
        }
    )
    assert create_res.status_code == 201
    key_data = create_res.json()
    assert "raw_key" in key_data
    assert key_data["raw_key"].startswith("tk_live_")
    assert key_data["name"] == "GitHub Actions CI Key"
    raw_key = key_data["raw_key"]
    key_id = key_data["id"]

    # 2. List API keys
    list_res = client.get("/api/v1/integrations/api-keys", headers=admin_headers)
    assert list_res.status_code == 200
    keys = list_res.json()
    assert len(keys) == 1
    assert "raw_key" not in keys[0]  # Raw key must NOT be stored or returned in list
    assert keys[0]["id"] == key_id

    # 3. Use raw_key to access candidate endpoints via X-API-Key
    cand_res = client.post(
        "/api/v1/candidates",
        headers={"X-API-Key": raw_key},
        json={
            "name": "John Doe External",
            "email": "john.external@example.com",
            "role_applied": "DevOps Engineer",
            "skills": "Docker, Kubernetes, AWS"
        }
    )
    assert cand_res.status_code == 201
    created_candidate = cand_res.json()
    assert created_candidate["name"] == "John Doe External"

    # 4. Fetch candidate list with API key
    fetch_res = client.get("/api/v1/candidates", headers={"X-API-Key": raw_key})
    assert fetch_res.status_code == 200
    assert fetch_res.json()["total"] == 1

    # 5. Revoke API key
    del_res = client.delete(f"/api/v1/integrations/api-keys/{key_id}", headers=admin_headers)
    assert del_res.status_code == 200

    # 6. Verify revoked key fails authentication
    fail_res = client.get("/api/v1/candidates", headers={"X-API-Key": raw_key})
    assert fail_res.status_code == 401

def test_webhook_crud_and_hmac_signing(client, db_session):
    admin_headers = get_admin_headers(client, db_session)

    # 1. Create Webhook
    wh_res = client.post(
        "/api/v1/integrations/webhooks",
        headers=admin_headers,
        json={
            "url": "https://httpbin.org/post",
            "secret": "my-secure-webhook-secret-key-123",
            "events": ["candidate.created", "score.submitted"],
            "description": "Slack Alert Dispatcher"
        }
    )
    assert wh_res.status_code == 201
    wh_data = wh_res.json()
    webhook_id = wh_data["id"]
    assert wh_data["url"] == "https://httpbin.org/post"
    assert wh_data["events"] == ["candidate.created", "score.submitted"]

    # 2. List Webhooks
    list_res = client.get("/api/v1/integrations/webhooks", headers=admin_headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1

    # 3. Verify HMAC signature computation
    secret = "my-secure-webhook-secret-key-123"
    test_payload = b'{"event":"test.ping"}'
    signature = compute_hmac_signature(secret, test_payload)
    assert signature.startswith("sha256=")

    expected_raw_sig = hmac.new(secret.encode("utf-8"), test_payload, hashlib.sha256).hexdigest()
    assert signature == f"sha256={expected_raw_sig}"

    # 4. Update Webhook
    patch_res = client.patch(
        f"/api/v1/integrations/webhooks/{webhook_id}",
        headers=admin_headers,
        json={"description": "Updated Slack Dispatcher", "is_active": False}
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["description"] == "Updated Slack Dispatcher"
    assert patch_res.json()["is_active"] is False

    # 5. Delete Webhook
    del_res = client.delete(f"/api/v1/integrations/webhooks/{webhook_id}", headers=admin_headers)
    assert del_res.status_code == 200

def test_export_endpoints(client, db_session):
    admin_headers = get_admin_headers(client, db_session)

    # Create candidate
    client.post(
        "/api/v1/candidates",
        headers=admin_headers,
        json={
            "name": "Jane Export",
            "email": "jane.export@example.com",
            "role_applied": "Frontend Architect",
            "skills": "React, TypeScript, CSS"
        }
    )

    # 1. Test CSV Export
    csv_res = client.get("/api/v1/export/candidates.csv", headers=admin_headers)
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    assert "Jane Export" in csv_res.text
    assert "Frontend Architect" in csv_res.text
    assert "Candidate ID,Name,Email,Role Applied" in csv_res.text

    # 2. Test JSON Export
    json_res = client.get("/api/v1/export/candidates.json", headers=admin_headers)
    assert json_res.status_code == 200
    data = json_res.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["name"] == "Jane Export"
    assert data[0]["role_applied"] == "Frontend Architect"
    assert "scores" in data[0]
