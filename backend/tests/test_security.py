"""Security controls: headers, CORS, rate limits, request size, tokens, passwords, input and uploads."""
import io
import uuid
import zipfile
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, PlainTextResponse
from fastapi.testclient import TestClient

from auth import auth_utils
from core import config, schemas, security
from core.config import settings
from core.frontend import PageLoadMiddleware
from services import github_service
from services.resume_intelligence import UNREADABLE_FILE
from tests.conftest import DEVOPS_RESUME, upload_text_resume

# A hash made by passlib (the library used before), for the password "correct-horse-battery".
LEGACY_PASSLIB_HASH = "$2b$12$2JscIp6f9G5rM0jYfUDi5.rR6vM0W7DzpXkfzQKzLrFyOHNGeEI0S"


@pytest.fixture
def limits_on(monkeypatch):
    """Turns rate limiting on for one test, with fresh counters before and after."""
    security.limiter.clear()
    monkeypatch.setattr(settings, "rate_limits_enabled", True)
    yield
    security.limiter.clear()


# --- headers and CORS ---

def test_api_responses_carry_security_headers(client):
    response = client.get("/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert "camera=(self)" in response.headers["Permissions-Policy"]
    assert response.headers["Content-Security-Policy"] == security.API_CSP
    assert response.headers["Cache-Control"] == "no-store"


def test_pages_get_the_app_policy_and_assets_get_none():
    app = FastAPI()
    app.add_middleware(security.SecurityHeadersMiddleware, hsts=True)
    app.get("/")(lambda: HTMLResponse("<p>hi</p>"))
    app.get("/worker.js")(lambda: PlainTextResponse("self.onmessage = () => {}", media_type="text/javascript"))
    with TestClient(app) as test_client:
        page = test_client.get("/")
        script = test_client.get("/worker.js")
    assert page.headers["Content-Security-Policy"] == security.APP_CSP
    assert "frame-ancestors 'none'" in page.headers["Content-Security-Policy"]
    assert "'unsafe-eval'" not in security.APP_CSP.replace("'wasm-unsafe-eval'", "")
    assert page.headers["Strict-Transport-Security"].startswith("max-age=31536000")
    # A worker inherits its script's CSP, so scripts must not get the API's "load nothing" policy.
    assert "Content-Security-Policy" not in script.headers
    assert script.headers["X-Content-Type-Options"] == "nosniff"


def test_cors_allows_only_configured_origins(client):
    allowed = client.options("/auth/login", headers={
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
    })
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-credentials" not in allowed.headers

    foreign = client.options("/auth/login", headers={
        "Origin": "https://evil.example", "Access-Control-Request-Method": "POST",
    })
    assert "access-control-allow-origin" not in foreign.headers
    simple = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in simple.headers


def test_page_loads_get_the_app_and_fetches_get_the_api(tmp_path):
    """/resumes is both an app page and an API endpoint; a refresh must show the page."""
    (tmp_path / "index.html").write_text("<!doctype html><p>app</p>")
    (tmp_path / "favicon.svg").write_text("<svg/>")
    app = FastAPI()
    app.add_middleware(PageLoadMiddleware, static_dir=tmp_path)
    app.get("/resumes")(lambda: {"detail": "api"})
    app.get("/favicon.svg")(lambda: PlainTextResponse("<svg/>", media_type="image/svg+xml"))
    with TestClient(app) as test_client:
        def get(path, **headers):
            return test_client.get(path, headers=headers)
        assert "app" in get("/resumes", **{"Sec-Fetch-Dest": "document"}).text
        assert get("/resumes", **{"Sec-Fetch-Dest": "empty", "Accept": "application/json"}).json() == {"detail": "api"}
        assert "app" in get("/resumes", Accept="text/html,application/xhtml+xml").text
        assert get("/resumes", Accept="application/json").json() == {"detail": "api"}
        assert get("/favicon.svg", **{"Sec-Fetch-Dest": "document"}).text == "<svg/>"


# --- configuration ---

def _settings(monkeypatch, **env):
    for name in ("APP_ENV", "DEMO_LOGIN_ENABLED", "ENABLE_API_DOCS", "CORS_ORIGINS", "SECRET_KEY"):
        monkeypatch.delenv(name, raising=False)
    for name, value in env.items():
        monkeypatch.setenv(name, value)
    return config.Settings()


def test_production_turns_off_docs_and_demo_by_default(monkeypatch):
    prod = _settings(monkeypatch, APP_ENV="production", SECRET_KEY="x" * 48)
    assert prod.is_production and not prod.docs_enabled and not prod.demo_login_enabled
    assert prod.problems() == []
    dev = _settings(monkeypatch, SECRET_KEY="x" * 48)
    assert dev.docs_enabled and dev.demo_login_enabled


def test_unsafe_configuration_is_reported(monkeypatch):
    problems = _settings(monkeypatch, APP_ENV="production", SECRET_KEY="short", CORS_ORIGINS="*").problems()
    assert any("32 characters" in p for p in problems)
    assert any('cannot be "*"' in p for p in problems)
    assert any("APP_ENV" in p for p in _settings(monkeypatch, APP_ENV="prod", SECRET_KEY="x" * 48).problems())
    assert any("https://" in p for p in _settings(
        monkeypatch, APP_ENV="production", SECRET_KEY="x" * 48, CORS_ORIGINS="http://prepsphere.example").problems())
    assert any("SECRET_KEY is not set" in p for p in _settings(monkeypatch).problems())


# --- rate limits ---

def test_limiter_uses_a_sliding_window():
    limiter = security.RateLimiter()
    assert limiter.hit("k", 2, 10, now=0) is None
    assert limiter.hit("k", 2, 10, now=1) is None
    assert limiter.hit("k", 2, 10, now=2) == 8       # wait until the first hit is 10 s old
    assert limiter.hit("k", 2, 10, now=10.5) is None  # the first hit has left the window
    assert limiter.hit("other", 2, 10, now=2) is None


def test_too_many_logins_from_one_address_are_refused(client, limits_on):
    for i in range(20):
        assert client.post("/auth/login", json={"email": f"nobody{i}@example.com", "password": "x"}).status_code == 400
    blocked = client.post("/auth/login", json={"email": "nobody@example.com", "password": "x"})
    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) > 0
    assert "Try again in" in blocked.json()["detail"]


def test_failed_logins_lock_one_account_for_a_while(client, signup, limits_on):
    email, _ = signup()
    for _ in range(3):
        client.post("/auth/login", json={"email": email, "password": "wrong-password"})
    assert client.post("/auth/login", json={"email": email, "password": "correct-horse-battery"}).status_code == 200
    # A success clears the count; ten more failures lock the account, even against the right password.
    for _ in range(security.FAILED_LOGIN_LIMIT):
        assert client.post("/auth/login", json={"email": email, "password": "wrong-password"}).status_code == 400
    locked = client.post("/auth/login", json={"email": email, "password": "correct-horse-battery"})
    assert locked.status_code == 429 and "failed sign-in attempts" in locked.json()["detail"]


def test_expensive_actions_are_limited_per_user(client, user_headers, limits_on):
    for _ in range(10):
        assert client.put("/profile/links", headers=user_headers, json={"linkedin": ""}).status_code == 200
    assert client.put("/profile/links", headers=user_headers, json={"linkedin": ""}).status_code == 429


# --- request size ---

def test_oversized_requests_are_refused_before_reading(client):
    too_big = b"x" * (settings.max_request_bytes + 1)
    response = client.post("/auth/login", content=too_big, headers={"Content-Type": "application/json"})
    assert response.status_code == 413
    assert "too large" in response.json()["detail"]


def test_streamed_bodies_are_counted_too():
    app = FastAPI()
    app.add_middleware(security.BodySizeLimitMiddleware, max_bytes=100)

    @app.post("/echo")
    async def echo(request: security.Request):
        return {"size": len(await request.body())}

    with TestClient(app) as test_client:
        assert test_client.post("/echo", content=b"x" * 100).json() == {"size": 100}
        assert test_client.post("/echo", content=b"x" * 101).status_code == 413
        streamed = test_client.post("/echo", content=iter([b"x" * 60, b"x" * 60]))
        assert streamed.status_code == 413


# --- tokens ---

def _token(claims, key=None, algorithm="HS256"):
    return jwt.encode(claims, key if key is not None else settings.secret_key, algorithm=algorithm)


def test_forged_and_expired_tokens_are_rejected(client, signup):
    email, headers = signup()
    future = datetime.now(timezone.utc) + timedelta(hours=1)
    assert client.get("/users/me", headers=headers).status_code == 200
    forged = [
        _token({"sub": email, "exp": future}, key="a-different-secret-key-that-is-long-enough"),
        jwt.encode({"sub": email, "exp": future}, key=None, algorithm="none"),
        _token({"sub": email, "exp": datetime.now(timezone.utc) - timedelta(minutes=1)}),
        _token({"sub": email}),                                    # no expiry
        _token({"exp": future}),                                   # no subject
        headers["Authorization"].split()[1][:-4] + "abcd",         # tampered signature
    ]
    for token in forged:
        assert client.get("/users/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401, token


# --- passwords ---

def test_passwords_are_bcrypt_and_old_hashes_still_work():
    fresh = auth_utils.get_password_hash("correct-horse-battery")
    assert fresh.startswith("$2b$12$")
    assert auth_utils.verify_password("correct-horse-battery", fresh)
    assert auth_utils.verify_password("correct-horse-battery", LEGACY_PASSLIB_HASH)
    assert not auth_utils.verify_password("wrong", LEGACY_PASSLIB_HASH)
    assert not auth_utils.verify_password("anything", "not-a-hash")
    assert not auth_utils.verify_password("anything", None)
    # Long passwords are pre-hashed, so characters past bcrypt's 72-byte limit still count.
    long_password = "a" * 100
    assert not auth_utils.verify_password(long_password + "b", auth_utils.get_password_hash(long_password + "c"))


def test_unknown_emails_cost_the_same_password_check(client, monkeypatch):
    calls = []
    real = auth_utils.bcrypt.checkpw
    monkeypatch.setattr(auth_utils.bcrypt, "checkpw", lambda *a: calls.append(1) or real(*a))
    response = client.post("/auth/login", json={"email": f"ghost-{uuid.uuid4().hex}@example.com", "password": "whatever1"})
    assert response.status_code == 400 and response.json()["detail"] == "Invalid email or password"
    assert len(calls) == 1


# --- input ---

@pytest.mark.parametrize("name", ["<script>alert(1)</script>", "Robert\"); DROP", "=HYPERLINK(\"x\")", "@SUM(A1)"])
def test_names_with_markup_or_formulas_are_rejected(client, name):
    response = client.post("/auth/signup", json={
        "name": name, "email": f"n-{uuid.uuid4().hex[:8]}@example.com", "password": "correct-horse-battery",
    })
    assert response.status_code == 422


def test_names_are_cleaned_of_invisible_characters(client):
    email = f"n-{uuid.uuid4().hex[:8]}@example.com"
    token = client.post("/auth/signup", json={
        "name": "  Ann\u0000a​   Rao ", "email": email, "password": "correct-horse-battery",
    }).json()["access_token"]
    assert client.get("/users/me", headers={"Authorization": f"Bearer {token}"}).json()["name"] == "Anna Rao"
    assert schemas.clean_display_name("==<b>Meera</b>") == "bMeera/b"


# --- uploads ---

def test_docx_zip_bombs_are_refused(client, user_headers):
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("word/document.xml", b"\0" * (60 * 1024 * 1024))  # compresses to well under 1 MB
    response = client.post("/resumes/upload", headers=user_headers,
                           files={"file": ("bomb.docx", archive.getvalue(), "application/octet-stream")})
    assert response.status_code == 400
    assert "unusually large" in response.json()["detail"]


def test_unreadable_files_get_a_plain_message(client, user_headers):
    response = client.post("/resumes/upload", headers=user_headers,
                           files={"file": ("cv.pdf", b"%PDF-1.7 this is not really a pdf " * 20, "application/pdf")})
    assert response.status_code == 400
    assert response.json()["detail"] == UNREADABLE_FILE


def test_other_users_cannot_select_or_delete_a_resume(client, signup):
    _, owner = signup()
    _, other = signup()
    resume_id = upload_text_resume(client, owner, DEVOPS_RESUME).json()["resume_id"]
    assert client.post(f"/resumes/{resume_id}/select", headers=other).status_code == 404
    assert client.delete(f"/resumes/{resume_id}", headers=other).status_code == 404
    assert client.get(f"/resumes/{resume_id}/profile", headers=owner).status_code == 200


def test_github_links_must_point_at_github():
    data = github_service.summarize(
        {"login": "octo", "html_url": "javascript:alert(1)"},
        [{"name": "repo", "html_url": "javascript:alert(2)", "fork": False}],
    )
    assert data["profile_url"] == "https://github.com/octo"
    assert data["top_repos"][0]["url"] == "https://github.com/octo/repo"
