# PrepSphere Backend

**Architected & Authored by: [Karan Shelar](https://github.com/Edge-Explorer)**

FastAPI service for authentication, resume analysis, skill-gap scoring and AI mock interviews. See the [root README](../README.md) for the full picture.

```bash
python -m venv venv && source venv/bin/activate   # Windows: .\venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env    # set SECRET_KEY
python main.py          # http://127.0.0.1:8000/docs
pytest                  # run the test suite
```

## Layout

| Path | Purpose |
| --- | --- |
| `main.py` | App setup and all HTTP endpoints |
| `core/config.py` | Every environment setting, read once |
| `core/models.py`, `core/schemas.py` | Database models and API schemas |
| `core/migrations.py`, `migrations/` | Alembic migrations, applied automatically at startup |
| `core/seed_data.py`, `core/company_data.py` | Role/skill catalog and company data (synced at startup, updated in place) |
| `services/` | Gemini, resume, job description, skill taxonomy, skill gap and candidate profile logic |
| `tests/` | pytest suite (throwaway SQLite database, no API keys needed) |

## Database migrations

Schema changes go through Alembic:

```bash
# after editing core/models.py
alembic revision --autogenerate -m "describe the change"
# review the generated file in migrations/versions/, then restart the app (or run: alembic upgrade head)
```

The folders `alembic/`, `scripts/`, `data/`, `services/intelligence_service.py`, `services/company_intelligence.py`, `services/memory_service.py`, `core/round_config.py` and the older test files belong to the legacy InterviewAI prototype. The app does not use them, and they can be deleted.
