from app.models import User, Candidate, Score
from app.auth import hash_password
from tests.conftest import get_auth_headers

def test_unauthenticated_analytics_rejected(client):
    res = client.get("/api/v1/analytics")
    assert res.status_code == 401

def test_admin_analytics_access_and_metrics(client, db_session):
    admin = User(email="analytics_admin@techkraft.com", hashed_password=hash_password("password123"), role="admin")
    rev1 = User(email="rev1@techkraft.com", hashed_password=hash_password("password123"), role="reviewer")
    c1 = Candidate(name="Alice Walker", email="alice@test.com", role_applied="Backend Engineer", status="reviewed", skills="Python, FastAPI, PostgreSQL")
    c2 = Candidate(name="Bob Smith", email="bob@test.com", role_applied="Frontend Engineer", status="new", skills="React, TypeScript, CSS")
    c3 = Candidate(name="Charlie Brown", email="charlie@test.com", role_applied="Backend Engineer", status="hired", skills="Python, Docker")
    c4 = Candidate(name="David Stone", email="david@test.com", role_applied="DevOps", status="archived", skills="Kubernetes, Terraform")

    db_session.add_all([admin, rev1, c1, c2, c3, c4])
    db_session.commit()

    # Add scores
    s1 = Score(candidate_id=c1.id, reviewer_id=rev1.id, category="Technical", score=5, note="Excellent")
    s2 = Score(candidate_id=c1.id, reviewer_id=rev1.id, category="Communication", score=4, note="Good")
    s3 = Score(candidate_id=c3.id, reviewer_id=admin.id, category="Technical", score=5, note="Top tier")
    db_session.add_all([s1, s2, s3])
    db_session.commit()

    admin_token = client.post("/api/v1/auth/login", json={"email": "analytics_admin@techkraft.com", "password": "password123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    res = client.get("/api/v1/analytics", headers=headers)
    assert res.status_code == 200
    data = res.json()

    # KPI assertions
    assert data["kpis"]["total_candidates"] == 4
    assert data["kpis"]["active_candidates"] == 3
    assert data["kpis"]["archived_candidates"] == 1
    assert data["kpis"]["total_reviews"] == 3
    assert data["kpis"]["average_score"] == 4.67
    assert data["kpis"]["review_coverage_pct"] == 66.7

    # Funnel stages
    funnel_map = {f["stage"]: f["count"] for f in data["funnel"]}
    assert funnel_map["new"] == 1
    assert funnel_map["reviewed"] == 1
    assert funnel_map["hired"] == 1
    assert funnel_map["archived"] == 1

    # Categories
    categories_map = {c["category"]: c["average_score"] for c in data["categories"]}
    assert categories_map["Technical"] == 5.0
    assert categories_map["Communication"] == 4.0

    # Score distribution
    score_dist_map = {sd["score"]: sd["count"] for sd in data["score_distribution"]}
    assert score_dist_map[5] == 2
    assert score_dist_map[4] == 1
    assert score_dist_map[1] == 0

    # Reviewer activity is available for admin
    assert data["reviewer_activity"] is not None
    rev_emails = [ra["reviewer_email"] for ra in data["reviewer_activity"]]
    assert "rev1@techkraft.com" in rev_emails
    assert "analytics_admin@techkraft.com" in rev_emails

    # Top skills
    skills_map = {s["skill"]: s["count"] for s in data["top_skills"]}
    assert skills_map["Python"] == 2
    assert skills_map["FastAPI"] == 1

def test_reviewer_analytics_rbac_isolation(client, db_session):
    rev1 = User(email="rev_self@techkraft.com", hashed_password=hash_password("password123"), role="reviewer")
    rev2 = User(email="rev_other@techkraft.com", hashed_password=hash_password("password123"), role="reviewer")
    cand = Candidate(name="Eve Adams", email="eve@test.com", role_applied="Fullstack", status="reviewed", skills="React, Node")
    db_session.add_all([rev1, rev2, cand])
    db_session.commit()

    s1 = Score(candidate_id=cand.id, reviewer_id=rev1.id, category="Coding", score=4)
    s2 = Score(candidate_id=cand.id, reviewer_id=rev2.id, category="System Architecture", score=2)
    db_session.add_all([s1, s2])
    db_session.commit()

    token = client.post("/api/v1/auth/login", json={"email": "rev_self@techkraft.com", "password": "password123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/analytics", headers=headers)
    assert res.status_code == 200
    data = res.json()

    # Reviewer MUST NOT receive full team reviewer activity
    assert data["reviewer_activity"] is None

    # Reviewer receives own contribution stats
    assert data["my_stats"] is not None
    assert data["my_stats"]["my_reviews_count"] == 1
    assert data["my_stats"]["my_candidates_reviewed"] == 1
    assert data["my_stats"]["my_average_score"] == 4.0
