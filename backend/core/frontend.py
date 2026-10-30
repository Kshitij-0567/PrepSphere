"""Serving the built React app from the backend (production and the Docker image)."""
from pathlib import Path
from typing import Dict

from starlette.responses import FileResponse
from starlette.types import ASGIApp, Receive, Scope, Send


def is_page_load(headers: Dict[bytes, bytes]) -> bool:
    """True when the browser is loading a page into a tab, rather than fetching data."""
    dest = headers.get(b"sec-fetch-dest")
    if dest is not None:
        return dest == b"document"
    # Browsers without Fetch Metadata headers ask for HTML first when loading a page.
    return headers.get(b"accept", b"").startswith(b"text/html")


class PageLoadMiddleware:
    """Several app pages share a path with an API endpoint (/resumes, /companies, /showcase...).
    A browser loading or refreshing such a page must get the app, not the endpoint's JSON. The
    app's own API calls are fetches, never page loads, so they still reach the API."""

    def __init__(self, app: ASGIApp, static_dir: Path) -> None:
        self.app = app
        self.static_dir = static_dir
        self.index = static_dir / "index.html"

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope["method"] in ("GET", "HEAD"):
            headers = dict(scope.get("headers") or [])
            if is_page_load(headers) and not self._is_static_file(scope["path"]):
                await FileResponse(self.index)(scope, receive, send)
                return
        await self.app(scope, receive, send)

    def _is_static_file(self, path: str) -> bool:
        candidate = (self.static_dir / path.lstrip("/")).resolve()
        return candidate.is_file() and self.static_dir in candidate.parents
