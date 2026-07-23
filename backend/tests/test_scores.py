from app.models import User, Candidate, Score
from app.auth import hash_password

def test_reviewer_cannot_see_other_reviewer_scores(client, db_session):
    rev1 = User(email="rev1@techkraft.com", hashed_password=hash_password("pwd12345"), role="reviewer")
    rev2 = User(email="rev2@techkraft.com", hashed_password=hash_password("pwd12345"), role="reviewer")
    admin = User(email="admin_user@techkraft.com", hashed_password=hash_password("pwd12345"), role="admin")
    cand = Candidate(name="Sam Smith", email="sam@example.com", role_applied="Backend Engineer")

    db_session.add_all([rev1, rev2, admin, cand])
    db_session.commit()

    score1 = Score(candidate_id=cand.id, reviewer_id=rev1.id, category="System Design", score=5, note="Great")
    score2 = Score(candidate_id=cand.id, reviewer_id=rev2.id, category="System Design", score=2, note="Poor")
    db_session.add_all([score1, score2])
    db_session.commit()

    token1_res = client.post("/api/v1/auth/login", json={"email": "rev1@techkraft.com", "password": "pwd12345"})
    token1 = token1_res.json()["access_token"]
    h1 = {"Authorization": f"Bearer {token1}"}

    cand_detail_rev1 = client.get(f"/api/v1/candidates/{cand.id}", headers=h1).json()
    assert len(cand_detail_rev1["scores"]) == 1
    assert cand_detail_rev1["scores"][0]["reviewer_id"] == rev1.id
    assert cand_detail_rev1["internal_notes"] is None

    token_admin_res = client.post("/api/v1/auth/login", json={"email": "admin_user@techkraft.com", "password": "pwd12345"})
    token_admin = token_admin_res.json()["access_token"]
    h_admin = {"Authorization": f"Bearer {token_admin}"}

    cand_detail_admin = client.get(f"/api/v1/candidates/{cand.id}", headers=h_admin).json()
    assert len(cand_detail_admin["scores"]) == 2

def test_score_upsert(client, db_session):
    rev = User(email="score_rev@techkraft.com", hashed_password=hash_password("pwd12345"), role="reviewer")
    cand = Candidate(name="Nirmal Shah", email="nirmal@example.com", role_applied="QA Engineer")
    db_session.add_all([rev, cand])
    db_session.commit()

    token = client.post("/api/v1/auth/login", json={"email": "score_rev@techkraft.com", "password": "pwd12345"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    s1 = client.post(f"/api/v1/candidates/{cand.id}/scores", headers=headers, json={"category": "Coding", "score": 3, "note": "Fair"})
    assert s1.status_code == 201

    s2 = client.post(f"/api/v1/candidates/{cand.id}/scores", headers=headers, json={"category": "Coding", "score": 5, "note": "Improved!"})
    assert s2.status_code == 201

    scores = db_session.query(Score).filter(Score.candidate_id == cand.id, Score.reviewer_id == rev.id).all()
    assert len(scores) == 1
    assert scores[0].score == 5
    assert scores[0].note == "Improved!"
