from datetime import datetime, timezone

import pytest
import jwt

from auth import auth_utils
from core.config import settings


def test_signup_login_and_me(client, signup):
    email, headers = signup("Ada Lovelace")
    me = client.get("/users/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == email
    assert me.json()["name"] == "Ada Lovelace"

    login = client.post("/auth/login", json={"email": email, "password": "correct-horse-battery"})
    assert login.status_code == 200
    assert login.json()["user"]["email"] == email


def test_email_is_case_insensitive(client):
    response = client.post("/auth/signup", json={"email": "Mixed.Case@Example.com", "password": "password123"})
    assert response.status_code == 200
    assert response.json()["user_email"] == "mixed.case@example.com"

    login = client.post("/auth/login", json={"email": "MIXED.case@example.COM", "password": "password123"})
    assert login.status_code == 200

    duplicate = client.post("/auth/signup", json={"email": "mixed.CASE@example.com", "password": "password123"})
    assert duplicate.status_code == 400


def test_signup_validation(client):
    assert client.post("/auth/signup", json={"email": "not-an-email", "password": "password123"}).status_code == 422
    assert client.post("/auth/signup", json={"email": "short@example.com", "password": "short"}).status_code == 422


def test_wrong_password_is_rejected(client, signup):
    email, _ = signup()
    response = client.post("/auth/login", json={"email": email, "password": "wrong-password"})
    assert response.status_code == 400


def test_token_lifetime_comes_from_settings(client, signup):
    email, headers = signup()
    token = headers["Authorization"].split()[1]
    claims = jwt.decode(token, settings.secret_key, algorithms=[auth_utils.ALGORITHM])
    lifetime_minutes = (claims["exp"] - datetime.now(timezone.utc).timestamp()) / 60
    assert abs(lifetime_minutes - settings.access_token_expire_minutes) < 2


def test_invalid_token_is_rejected(client):
    assert client.get("/users/me", headers={"Authorization": "Bearer not-a-token"}).status_code == 401


def test_verify_password_handles_accounts_without_password():
    assert auth_utils.verify_password("anything", None) is False
    assert auth_utils.verify_password("anything", "GOOGLE_OAUTH_USER") is False


def test_google_login_requires_configuration(client):
    response = client.post("/auth/google", json={"token": "whatever"})
    assert response.status_code == 503


def test_google_login_checks_audience_and_verified_email(client, monkeypatch):
    import main

    calls = {}

    def fake_verify(token, request, audience):
        calls["audience"] = audience
        if token == "bad":
            raise ValueError("Token has wrong audience")
        return {"email": "Google.User@Example.com", "email_verified": token != "unverified", "name": "G User"}

    monkeypatch.setattr(settings, "google_client_id", "my-client-id.apps.googleusercontent.com")
    monkeypatch.setattr(main.id_token, "verify_oauth2_token", fake_verify)

    assert client.post("/auth/google", json={"token": "bad"}).status_code == 401
    assert calls["audience"] == "my-client-id.apps.googleusercontent.com"
    assert client.post("/auth/google", json={"token": "unverified"}).status_code == 401

    ok = client.post("/auth/google", json={"token": "good"})
    assert ok.status_code == 200
    assert ok.json()["user_email"] == "google.user@example.com"

    # A Google-only account has no password: password login fails cleanly instead of crashing.
    login = client.post("/auth/login", json={"email": "google.user@example.com", "password": "guess12345"})
    assert login.status_code == 400


def test_demo_login_creates_isolated_accounts(client):
    first = client.post("/auth/demo").json()
    second = client.post("/auth/demo").json()
    assert first["user_email"] != second["user_email"]
    assert client.get("/users/me", headers={"Authorization": f"Bearer {first['access_token']}"}).status_code == 200


def test_demo_login_can_be_disabled(client, monkeypatch):
    monkeypatch.setattr(settings, "demo_login_enabled", False)
    assert client.post("/auth/demo").status_code == 404


@pytest.mark.parametrize("path", ["/resumes", "/skill-gaps?role_id=1", "/interviews/history", "/recommendations"])
def test_protected_endpoints_require_auth(client, path):
    assert client.get(path).status_code == 401
