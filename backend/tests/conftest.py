"""
Every test run uses a throwaway SQLite database and no Gemini key, so the suite is
deterministic, free, and never touches real data. These variables must be set before
any application module is imported.
"""
import os
import sys
import tempfile
import uuid
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

_TMP_DIR = Path(tempfile.mkdtemp(prefix="prepsphere-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(_TMP_DIR / 'test.db').as_posix()}"
os.environ["SECRET_KEY"] = "test-secret-key-that-is-long-enough-for-hs256-signing"
os.environ["GEMINI_API_KEY"] = ""
os.environ["GOOGLE_CLIENT_ID"] = ""
os.environ["DEMO_LOGIN_ENABLED"] = "true"
os.environ["APP_ENV"] = "development"
# The suite creates hundreds of accounts from one address; test_security.py turns limits on.
os.environ["RATE_LIMITS_ENABLED"] = "false"
os.environ["STATIC_DIR"] = str(_TMP_DIR / "no-frontend-build")


@pytest.fixture(scope="session")
def tmp_dir() -> Path:
    return _TMP_DIR


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient
    import main

    with TestClient(main.app) as test_client:
        yield test_client


def _signup(client, name="Test Candidate"):
    email = f"user-{uuid.uuid4().hex[:12]}@example.com"
    response = client.post("/auth/signup", json={"name": name, "email": email, "password": "correct-horse-battery"})
    assert response.status_code == 200, response.text
    return email, {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
def signup(client):
    """Creates a fresh user; returns (email, auth headers)."""
    return lambda name="Test Candidate": _signup(client, name)


@pytest.fixture
def user_headers(signup):
    return signup()[1]


@pytest.fixture(scope="session")
def roles(client):
    return {role["name"]: role for role in client.get("/roles").json()}


def upload_text_resume(client, headers, text: str, filename: str = "resume.txt"):
    return client.post("/resumes/upload", headers=headers, files={"file": (filename, text.encode(), "text/plain")})


DEVOPS_RESUME = """Priya Sharma
priya.sharma@gmail.com | github.com/priya-sharma | +91 98765 43210
Skills: Python, Linux, Bash, Docker, Kubernetes, Terraform, AWS, GitHub Actions
Experience: DevOps Intern at CloudCo. Built CI/CD pipelines with GitHub Actions and Docker,
deploying to a Kubernetes cluster on AWS.
Project: Automated Linux server provisioning with Bash scripts and Docker images.
"""

FRONTEND_RESUME = """Arjun Mehta
arjun@example.com
Skills: JavaScript, TypeScript, React, HTML, CSS
Project: Built a React dashboard in TypeScript with responsive CSS layouts.
"""
