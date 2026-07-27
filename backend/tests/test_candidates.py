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

def test_candidate_sorting(client, db_session):
    from app.models import Score
    headers = get_auth_headers(client, "sorter@techkraft.com")
    rev = db_session.query(User).filter(User.email == "sorter@techkraft.com").first()

    c1 = Candidate(name="Alice Alpha", email="alice@test.com", role_applied="Dev")
    c2 = Candidate(name="Bob Beta", email="bob@test.com", role_applied="Dev")
    db_session.add_all([c1, c2])
    db_session.commit()

    # Give Alice a score of 3, Bob a score of 5
    s1 = Score(candidate_id=c1.id, reviewer_id=rev.id, category="Code Quality", score=3)
    s2 = Score(candidate_id=c2.id, reviewer_id=rev.id, category="Code Quality", score=5)
    db_session.add_all([s1, s2])
    db_session.commit()

    # Sort average score desc -> Bob (5.0) before Alice (3.0)
    res_desc = client.get("/api/v1/candidates?sort_by=average_score&sort_order=desc", headers=headers)
    assert res_desc.status_code == 200
    items = res_desc.json()["items"]
    assert items[0]["id"] == c2.id
    assert items[1]["id"] == c1.id

    # Sort average score asc -> Alice (3.0) before Bob (5.0)
    res_asc = client.get("/api/v1/candidates?sort_by=average_score&sort_order=asc", headers=headers)
    assert res_asc.status_code == 200
    items_asc = res_asc.json()["items"]
    assert items_asc[0]["id"] == c1.id
    assert items_asc[1]["id"] == c2.id

