# Contributing to PrepSphere

Thanks for helping out. This guide covers setting up, making a change and opening a pull request.

## Set up

Follow [Quick start](README.md#quick-start) in the README to run the backend (port 8000) and the frontend (port 5173). You need Python 3.11+ and Node.js 20+. A Gemini key is optional: without one, every AI feature uses a labelled fallback.

## Make a change

1. Create a branch from `main`: `git checkout -b fix/short-description` or `feature/short-description`.
2. Keep each pull request to one topic.
3. If you change `backend/core/models.py`, add a migration:
   ```bash
   cd backend
   alembic revision --autogenerate -m "describe the change"
   ```
   Review the generated file in `migrations/versions/` before committing.
4. Add or update tests for behaviour you change.

## Check before pushing

```bash
cd backend && pytest
cd frontend && npm run lint && npm run build
```

CI runs the same checks on every pull request and must pass before merging.

## Style

- **Python:** follow the style of the surrounding code. Services in `backend/services/` hold the logic; `main.py` stays a thin layer of endpoints.
- **React:** function components and hooks. Signed-in pages use the shared `ps-` classes and design tokens in `src/styles/app.css`.
- **Commit messages:** short and imperative, for example "Add country filter to the showcase".
- **User-facing text:** plain and specific. Error messages say what went wrong and how to fix it.

## Never commit

- `.env` files or any key, token or password. Use `.env.example` to document new settings.
- Database files (`*.db`) or their backups. They contain users' personal data.
- Build output (`dist/`), `node_modules/` or virtual environments.

If you commit a secret by mistake, rotate it immediately. Removing it in a later commit does not remove it from the history.
