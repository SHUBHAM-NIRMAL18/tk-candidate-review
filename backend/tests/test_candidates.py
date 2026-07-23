from app.models import User, Candidate
from app.auth import hash_password
from tests.conftest import get_auth_headers

def test_create_and_list_candidates(client):
    headers = get_auth_headers(client, "user1@techkraft.com")

    cand_res = client.post(
        "/api/v1/candidates",
        headers=headers,
        json={
            "name": "Jane Doe",
            "email": "jane@example.com",
            "role_applied": "Full Stack Engineer",
            "skills": "Python, React",
            "internal_notes": "Top tier candidate"
        }
    )
    assert cand_res.status_code == 201
    cand_data = cand_res.json()
    assert cand_data["name"] == "Jane Doe"
    assert cand_data["internal_notes"] is None

    list_res = client.get("/api/v1/candidates?role_applied=Full Stack", headers=headers)
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert len(items) >= 1
    assert items[0]["name"] == "Jane Doe"

def test_candidate_soft_delete_rbac(client, db_session):
    reviewer = User(email="rev_deleter@techkraft.com", hashed_password=hash_password("pwd12345"), role="reviewer")
    admin = User(email="admin_deleter@techkraft.com", hashed_password=hash_password("pwd12345"), role="admin")
    cand = Candidate(name="Mark Wood", email="mark@example.com", role_applied="DevOps")
    db_session.add_all([reviewer, admin, cand])
    db_session.commit()

    rev_token = client.post("/api/v1/auth/login", json={"email": "rev_deleter@techkraft.com", "password": "pwd12345"}).json()["access_token"]
    h_rev = {"Authorization": f"Bearer {rev_token}"}

    del_res_rev = client.delete(f"/api/v1/candidates/{cand.id}", headers=h_rev)
    assert del_res_rev.status_code == 403

    admin_token = client.post("/api/v1/auth/login", json={"email": "admin_deleter@techkraft.com", "password": "pwd12345"}).json()["access_token"]
    h_admin = {"Authorization": f"Bearer {admin_token}"}

    del_res_admin = client.delete(f"/api/v1/candidates/{cand.id}", headers=h_admin)
    assert del_res_admin.status_code == 200

    db_session.refresh(cand)
    assert cand.status == "archived"
