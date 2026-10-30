# Security Policy

## Reporting a vulnerability

Please do not open a public issue for security problems. Report them privately through GitHub's **Security → Report a vulnerability** form on this repository, or contact the maintainers directly.

Include what you found, how to reproduce it, and what an attacker could do with it. You will get a reply within a week.

## Handling secrets

- Secrets live only in `backend/.env`, which is ignored by git and by Docker. `backend/.env.example` documents every setting without values.
- `VITE_` variables in `frontend/.env` are compiled into the public JavaScript bundle. Never put a secret in one.
- Generate `SECRET_KEY` with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Changing it signs every user out.
- If a key is ever committed, rotate it at its provider right away. Deleting it in a later commit does not remove it from the git history.

## Before deploying

- [ ] Run with `APP_ENV=production` (the Docker image sets it). This hides the API docs, turns off demo login and refuses unsafe settings.
- [ ] Serve the site over HTTPS only, and list the exact `https://` frontend origin in `CORS_ORIGINS`.
- [ ] Use a fresh `SECRET_KEY` of at least 32 random characters, different from the one used in development.
- [ ] Behind a reverse proxy or load balancer, set `FORWARDED_ALLOW_IPS` to its address, so rate limits apply per visitor.
- [ ] Keep the database file or PostgreSQL server off the public internet, and back it up somewhere private.
- [ ] Run `pytest` and `npm audit` before each release.

What the app already does (headers, rate limits, access checks, upload limits) is listed in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#security-notes).

## Personal data

The database stores users' emails, password hashes and resume text. Keep database files and their backups (`*.db`, `*.db.backup-*`) out of version control and out of shared folders. Published showcase resumes are redacted copies; see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#benchmarks-and-the-resume-showcase).
