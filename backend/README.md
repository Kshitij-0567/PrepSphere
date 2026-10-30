# PrepSphere Backend

FastAPI service for authentication, resume analysis, skill-gap scoring, text and video mock interviews, benchmarks and the resume showcase. See the [root README](../README.md) for the full picture and [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for how the pieces fit together.

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
| `auth/auth_utils.py` | Password hashing (bcrypt), JWT creation and the current-user dependency |
| `core/config.py` | Every environment setting, read once |
| `core/models.py`, `core/schemas.py` | Database models and API schemas |
| `core/migrations.py`, `migrations/` | Alembic migrations, applied automatically at startup (SQLite is backed up first) |
| `core/seed_data.py`, `core/company_data.py` | Role/skill catalog and company data, synced at startup and updated in place |
| `core/countries.py` | ISO country list and country detection from a resume location |
| `tests/` | pytest suite: throwaway SQLite database, no API keys needed |

### Services

| Module | Responsibility |
| --- | --- |
| `gemini_service.py` | Async Gemini client (timeouts, JSON responses, fallback model). Generates questions, scores answers against a rubric and builds study recommendations. Candidate text is wrapped in delimiters the model is told never to obey. Every method has a deterministic fallback, labelled so the UI can mark scores as approximate. |
| `resume_intelligence.py` | PDF/DOCX/TXT text extraction, contact and link detection, structured sections, completeness score and improvement tips |
| `jd_intelligence.py` | Required and preferred skills, experience and education from a job description |
| `skill_taxonomy.py` | Skill catalog and aliases, evidence-based extraction, mapping broad role requirements to concrete resume skills |
| `skill_gap.py` | Weighted readiness score and strong / developing / minor gap / missing statuses |
| `candidate_profile.py` | The user's active resume and the skills derived from it |
| `github_service.py` | Public GitHub profile import (languages, topics, repositories) as extra skill evidence |
| `profile_summary.py` | Everything the profile page shows, built in one pass |
| `interview_plan.py` | Video interview step plans by role family and seniority |
| `video_interview.py` | Video step questions, one-call transcription and scoring, follow-up questions |
| `delivery.py` | Speaking pace, filler words, long pauses and eye contact |
| `benchmarks.py` | Cohorts per role and country, percentiles, top-candidate skills and the candidate score |
| `showcase.py` | Redacted published resumes, ranking, side-by-side comparison and reports |

## Database migrations

Schema changes go through Alembic:

```bash
# after editing core/models.py
alembic revision --autogenerate -m "describe the change"
# review the generated file in migrations/versions/, then restart the app (or run: alembic upgrade head)
```

`tests/test_migrations.py` fails if the migrations and the models ever disagree.
