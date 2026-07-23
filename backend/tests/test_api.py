import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models import Base, User, Candidate, Score
from app.database import get_db
from app.main import app
from app.auth import hash_password

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function", autouse=True)
def setup_test_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db_session(setup_test_database):
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="function")
def client(db_session):
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

def get_auth_headers(client, email="reviewer1@techkraft.com", password="password123"):
    res = client.post("/api/v1/auth/register", json={"email": email, "password": password})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_registration_hardcodes_reviewer_role(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "hacker@example.com",
            "password": "secretpassword",
            "role": "admin"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "reviewer"

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

def test_reviewer_cannot_see_other_reviewer_scores(client, db_session):
    rev1 = User(email="rev1@techkraft.com", hashed_password=hash_password("pwd"), role="reviewer")
    rev2 = User(email="rev2@techkraft.com", hashed_password=hash_password("pwd"), role="reviewer")
    admin = User(email="admin_user@techkraft.com", hashed_password=hash_password("pwd"), role="admin")
    cand = Candidate(name="Sam Smith", email="sam@example.com", role_applied="Backend Engineer")

    db_session.add_all([rev1, rev2, admin, cand])
    db_session.commit()

    score1 = Score(candidate_id=cand.id, reviewer_id=rev1.id, category="System Design", score=5, note="Great")
    score2 = Score(candidate_id=cand.id, reviewer_id=rev2.id, category="System Design", score=2, note="Poor")
    db_session.add_all([score1, score2])
    db_session.commit()

    token1_res = client.post("/api/v1/auth/login", json={"email": "rev1@techkraft.com", "password": "pwd"})
    token1 = token1_res.json()["access_token"]
    h1 = {"Authorization": f"Bearer {token1}"}

    cand_detail_rev1 = client.get(f"/api/v1/candidates/{cand.id}", headers=h1).json()
    assert len(cand_detail_rev1["scores"]) == 1
    assert cand_detail_rev1["scores"][0]["reviewer_id"] == rev1.id
    assert cand_detail_rev1["internal_notes"] is None

    token_admin_res = client.post("/api/v1/auth/login", json={"email": "admin_user@techkraft.com", "password": "pwd"})
    token_admin = token_admin_res.json()["access_token"]
    h_admin = {"Authorization": f"Bearer {token_admin}"}

    cand_detail_admin = client.get(f"/api/v1/candidates/{cand.id}", headers=h_admin).json()
    assert len(cand_detail_admin["scores"]) == 2

def test_candidate_soft_delete(client, db_session):
    headers = get_auth_headers(client, "deleter@techkraft.com")
    cand = Candidate(name="Mark Wood", email="mark@example.com", role_applied="DevOps")
    db_session.add(cand)
    db_session.commit()

    del_res = client.delete(f"/api/v1/candidates/{cand.id}", headers=headers)
    assert del_res.status_code == 200

    db_session.refresh(cand)
    assert cand.status == "archived"
