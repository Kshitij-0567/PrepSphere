"""
Imports a candidate's public GitHub profile: repository counts, language mix, top
repositories, and the skills their code demonstrates (from repository languages, topics
and descriptions). Uses GitHub's public REST API; no GitHub login is required.
"""
import logging
import re
from collections import Counter, defaultdict
from typing import Any, Dict, List, Optional

import httpx

from core.config import settings
from core.models import utcnow
from .skill_taxonomy import CANONICAL_TO_CATEGORY, extract_skills_with_evidence, normalize_skill

logger = logging.getLogger(__name__)

API = "https://api.github.com"
USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$")
TOP_LANGUAGES = 4


class GitHubError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code  # not_found | rate_limited | unavailable
        self.message = message


# GitHub language names that differ from the skill taxonomy's names.
GITHUB_LANGUAGE_SKILLS = {
    "Dockerfile": "Docker",
    "HCL": "Terraform",
    "Shell": "Shell Scripting",
    "Jupyter Notebook": "Python",
    "Vue": "Vue.js",
    "SCSS": "Sass",
}


def _github_link(url: Optional[str], fallback: str) -> str:
    """Links shown on the profile page must point at github.com over HTTPS, never at another
    scheme such as javascript:, whatever the API response says."""
    return url if isinstance(url, str) and url.startswith("https://github.com/") else fallback


def parse_username(value: str) -> Optional[str]:
    """Accepts 'name', '@name', 'github.com/name' or a full profile URL."""
    text = (value or "").strip()
    if text.startswith("@"):
        text = text[1:]
    match = re.match(r"^(?:(?:https?://)?(?:www\.)?github\.com/)?([^/?#\s]+)/?(?:[?#].*)?$", text, re.IGNORECASE)
    if not match:
        return None
    name = match.group(1)
    return name if USERNAME_PATTERN.match(name) else None


def _headers() -> Dict[str, str]:
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "PrepSphere", "X-GitHub-Api-Version": "2022-11-28"}
    if settings.github_token:
        headers["Authorization"] = f"Bearer {settings.github_token}"
    return headers


def _raise_for(response: httpx.Response, username: str) -> None:
    if response.status_code == 404:
        raise GitHubError("not_found", f"There is no GitHub user named {username}.")
    if response.status_code in (403, 429):
        raise GitHubError("rate_limited", "GitHub is limiting requests right now. Try syncing again in a few minutes.")
    if response.status_code >= 400:
        raise GitHubError("unavailable", "GitHub could not be reached. Try syncing again later.")


def _known_skill(raw: str) -> Optional[str]:
    """Canonical taxonomy name for a language/topic, or None if it is not a tracked skill."""
    if not raw:
        return None
    raw = GITHUB_LANGUAGE_SKILLS.get(raw, raw)
    canonical, _ = normalize_skill(raw.replace("-", " "))
    return canonical if canonical.lower() in CANONICAL_TO_CATEGORY else None


def summarize(user: Dict[str, Any], repos: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Turns raw GitHub API payloads into the profile summary PrepSphere stores."""
    own = [r for r in repos if not r.get("fork") and not r.get("archived")]

    weights: Counter = Counter()
    for repo in own:
        if repo.get("language"):
            weights[repo["language"]] += max(int(repo.get("size") or 0), 1)
    total = sum(weights.values())
    languages: List[Dict[str, Any]] = []
    if total:
        ranked = weights.most_common()
        shown = ranked[:TOP_LANGUAGES]
        for name, weight in shown:
            languages.append({"name": name, "pct": round(weight / total * 100)})
        other = total - sum(w for _, w in shown)
        if other > 0:
            languages.append({"name": "Other", "pct": round(other / total * 100)})
        # Keep the rounded shares summing to 100.
        drift = 100 - sum(l["pct"] for l in languages)
        languages[0]["pct"] += drift

    skill_repos: Dict[str, set] = defaultdict(set)
    for repo in own:
        name = repo.get("name") or ""
        candidates = [repo.get("language") or ""] + list(repo.get("topics") or [])
        for raw in candidates:
            skill = _known_skill(raw)
            if skill:
                skill_repos[skill].add(name)
        description = repo.get("description") or ""
        for found in extract_skills_with_evidence(description):
            if found["category"] != "Soft Skills":
                skill_repos[found["name"]].add(name)
    skills = [
        {"name": skill, "repos": len(names), "evidence": f"{skill} in {len(names)} {'repository' if len(names) == 1 else 'repositories'}"}
        for skill, names in sorted(skill_repos.items(), key=lambda item: (-len(item[1]), item[0]))
    ]

    top = sorted(own, key=lambda r: (r.get("stargazers_count") or 0, r.get("pushed_at") or ""), reverse=True)[:3]
    login = user.get("login") or ""
    return {
        "username": login,
        "name": user.get("name"),
        "profile_url": _github_link(user.get("html_url"), f"https://github.com/{login}"),
        "public_repos": user.get("public_repos") or len(own),
        "followers": user.get("followers") or 0,
        "stars": sum(r.get("stargazers_count") or 0 for r in own),
        "languages": languages,
        "top_repos": [
            {
                "name": r.get("name"),
                "description": r.get("description") or "",
                "language": r.get("language"),
                "stars": r.get("stargazers_count") or 0,
                "url": _github_link(r.get("html_url"), f"https://github.com/{login}/{r.get('name') or ''}"),
            }
            for r in top
        ],
        "skills": skills,
        "synced_at": utcnow().isoformat() + "Z",
    }


async def fetch_github_profile(username: str) -> Dict[str, Any]:
    try:
        async with httpx.AsyncClient(base_url=API, headers=_headers(), timeout=10.0) as client:
            user_response = await client.get(f"/users/{username}")
            _raise_for(user_response, username)
            repos_response = await client.get(
                f"/users/{username}/repos", params={"per_page": 100, "sort": "pushed", "type": "owner"}
            )
            _raise_for(repos_response, username)
    except httpx.HTTPError as exc:
        logger.warning("GitHub request failed for %s: %s", username, exc)
        raise GitHubError("unavailable", "GitHub could not be reached. Try syncing again later.") from exc
    return summarize(user_response.json(), repos_response.json())
