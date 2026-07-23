from app.models import User
from app.auth import hash_password

def test_registration_hardcodes_reviewer_role(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "hacker@example.com",
            "password": "secretpassword123",
            "role": "admin"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "reviewer"

def test_password_min_length_validation(client):
    res = client.post("/api/v1/auth/register", json={"email": "weak@example.com", "password": "short"})
    assert res.status_code == 422

def test_token_blacklisting_on_logout(client, db_session):
    user = User(email="logout_test@techkraft.com", hashed_password=hash_password("pwd12345"), role="reviewer")
    db_session.add(user)
    db_session.commit()

    login_res = client.post("/api/v1/auth/login", json={"email": "logout_test@techkraft.com", "password": "pwd12345"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    me_before = client.get("/api/v1/auth/me", headers=headers, cookies={"access_token": token})
    assert me_before.status_code == 200

    logout_res = client.post("/api/v1/auth/logout", headers=headers, cookies={"access_token": token})
    assert logout_res.status_code == 200

    me_after = client.get("/api/v1/auth/me", headers=headers, cookies={"access_token": token})
    assert me_after.status_code == 401
