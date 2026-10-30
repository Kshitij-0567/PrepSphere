"""
HTTP hardening applied to every request: security headers, a cap on request size, and rate limits.

Rate limits are counted in memory, per server process. That suits the single-process deployment
this app ships with (one uvicorn process, one Docker container). Behind a reverse proxy, set
FORWARDED_ALLOW_IPS to the proxy's address so uvicorn reports the real client IP; otherwise
every visitor would share the proxy's limit.
"""
import json
import math
import threading
import time
from collections import deque
from typing import Deque, Dict, Optional, Tuple

from fastapi import Depends, HTTPException, Request
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from auth import auth_utils
from core import models
from core.config import settings

# The built React app (served by this backend in production). Inline styles are needed by the
# code editor and animations; 'wasm-unsafe-eval' lets the face tracker run its WebAssembly.
APP_CSP = "; ".join([
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com/gsi/client",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob:",
    "connect-src 'self' https://accounts.google.com/gsi/",
    "frame-src https://accounts.google.com/gsi/",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
])
# API responses are data, never pages: nothing may load or frame them.
API_CSP = "default-src 'none'; frame-ancestors 'none'"
# Swagger UI loads its assets from a CDN; it is only served in development.
DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")
# The camera and microphone are used by the video interview on this site only.
PERMISSIONS_POLICY = "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()"


class SecurityHeadersMiddleware:
    """Adds security headers to every response."""

    def __init__(self, app: ASGIApp, hsts: bool = False) -> None:
        self.app = app
        self.hsts = hsts

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path = scope.get("path", "")

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                content_type = headers.get("content-type", "")
                headers["X-Content-Type-Options"] = "nosniff"
                headers["X-Frame-Options"] = "DENY"
                headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
                headers["Permissions-Policy"] = PERMISSIONS_POLICY
                if content_type.startswith("text/html"):
                    if not path.startswith(DOCS_PATHS):
                        headers["Content-Security-Policy"] = APP_CSP
                    # Google sign-in opens a popup that must be able to report back.
                    headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
                    headers.setdefault("Cache-Control", "no-cache")
                elif content_type.startswith("application/json"):
                    if not path.startswith(DOCS_PATHS):
                        headers["Content-Security-Policy"] = API_CSP
                    # API responses hold personal data: never keep them in a shared or disk cache.
                    headers["Cache-Control"] = "no-store"
                # Scripts, styles, fonts and models get no CSP of their own: a worker script would
                # inherit it and be unable to load anything.
                if self.hsts:
                    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
            await send(message)

        await self.app(scope, receive, send_with_headers)


class _BodyTooLarge(Exception):
    pass


class BodySizeLimitMiddleware:
    """Refuses request bodies over `max_bytes`, by Content-Length up front or while streaming."""

    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def _reject(self, send: Send) -> None:
        mb = self.max_bytes // (1024 * 1024)
        body = json.dumps({"detail": f"The request is too large. The limit is {mb} MB."}).encode()
        await send({"type": "http.response.start", "status": 413,
                    "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
        await send({"type": "http.response.body", "body": body})

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        for name, value in scope.get("headers", []):
            if name == b"content-length":
                try:
                    too_large = int(value) > self.max_bytes
                except ValueError:
                    too_large = True
                if too_large:
                    await self._reject(send)
                    return

        received = 0
        response_started = False

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise _BodyTooLarge()
            return message

        async def tracking_send(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracking_send)
        except _BodyTooLarge:
            if not response_started:
                await self._reject(send)


class RateLimiter:
    """Sliding-window request counters, kept in memory."""

    def __init__(self) -> None:
        self._hits: Dict[str, Tuple[float, Deque[float]]] = {}
        self._lock = threading.Lock()
        self._next_sweep = 0.0

    def _window(self, key: str, window: float, now: float) -> Deque[float]:
        _, hits = self._hits.setdefault(key, (window, deque()))
        while hits and hits[0] <= now - window:
            hits.popleft()
        return hits

    def hit(self, key: str, limit: int, window: float, now: Optional[float] = None) -> Optional[int]:
        """Counts one request. Returns the seconds to wait if the limit is already reached
        (the request is then not counted), or None if it is allowed."""
        now = time.monotonic() if now is None else now
        with self._lock:
            hits = self._window(key, window, now)
            if len(hits) >= limit:
                return max(1, math.ceil(hits[0] + window - now))
            hits.append(now)
            self._sweep(now)
        return None

    def blocked_for(self, key: str, limit: int, window: float, now: Optional[float] = None) -> Optional[int]:
        """Like hit(), but only checks; used for counting failures separately."""
        now = time.monotonic() if now is None else now
        with self._lock:
            hits = self._window(key, window, now)
            return max(1, math.ceil(hits[0] + window - now)) if len(hits) >= limit else None

    def clear(self, key: Optional[str] = None) -> None:
        with self._lock:
            if key is None:
                self._hits.clear()
            else:
                self._hits.pop(key, None)

    def _sweep(self, now: float) -> None:
        """Drops counters with no recent hits, so memory stays bounded. Caller holds the lock."""
        if now < self._next_sweep:
            return
        self._next_sweep = now + 60
        for key in [k for k, (window, hits) in self._hits.items() if not hits or hits[-1] <= now - window]:
            del self._hits[key]


limiter = RateLimiter()


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _too_many(wait: int, what: str = "requests") -> HTTPException:
    minutes = math.ceil(wait / 60)
    when = f"{wait} seconds" if wait < 90 else f"{minutes} minutes"
    return HTTPException(status_code=429, detail=f"Too many {what}. Try again in {when}.",
                         headers={"Retry-After": str(wait)})


def check(key: str, limit: int, window: float, what: str = "requests") -> None:
    if not settings.rate_limits_enabled:
        return
    wait = limiter.hit(key, limit, window)
    if wait:
        raise _too_many(wait, what)


def per_ip(name: str, limit: int, window: int):
    """Dependency: at most `limit` requests per `window` seconds from one IP address."""
    def dependency(request: Request) -> None:
        check(f"{name}:ip:{client_ip(request)}", limit, window)
    return Depends(dependency)


def per_user(name: str, limit: int, window: int):
    """Dependency: at most `limit` requests per `window` seconds from one signed-in user."""
    def dependency(user: models.User = Depends(auth_utils.get_current_user)) -> None:
        check(f"{name}:user:{user.id}", limit, window)
    return Depends(dependency)


# Every route, per IP address: generous enough for a classroom behind one network address,
# low enough to stop a script hammering the API.
global_limit = per_ip("all", 1200, 60)

# Failed sign-ins per email address, so one account cannot be guessed at from many addresses.
FAILED_LOGIN_LIMIT = 10
FAILED_LOGIN_WINDOW = 15 * 60


def login_blocked(email: str) -> None:
    if not settings.rate_limits_enabled:
        return
    wait = limiter.blocked_for(f"login-failed:{email}", FAILED_LOGIN_LIMIT, FAILED_LOGIN_WINDOW)
    if wait:
        raise _too_many(wait, "failed sign-in attempts for this account")


def record_failed_login(email: str) -> None:
    if settings.rate_limits_enabled:
        limiter.hit(f"login-failed:{email}", FAILED_LOGIN_LIMIT + 1, FAILED_LOGIN_WINDOW)


def clear_failed_logins(email: str) -> None:
    limiter.clear(f"login-failed:{email}")
