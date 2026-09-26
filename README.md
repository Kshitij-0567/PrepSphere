# PrepSphere — AI Interview Preparation & Skill Assessment

**Created & Authored by: [Karan Shelar](https://github.com/Edge-Explorer)**

PrepSphere helps engineering candidates find out how ready they are for a specific role, and then practise for it.

1. **Pick a role** from 34 engineering roles across software, AI/data, cloud, hardware/VLSI, robotics and core engineering, choose a seniority level, and optionally paste a real job description.
2. **Pick a target company** (350+ companies with interview focus areas, rounds and prep tips) or practise against a general standard.
3. **Upload a resume** (PDF, DOCX or TXT). Skills are extracted with evidence, and the resume gets a completeness check.
4. **See the skill gap**: every role requirement is marked strong, developing, minor gap or missing, with a readiness score weighted by importance.
5. **Take a 5-question text mock interview.** Questions are generated from the role, company, seniority, resume and gaps; each answer is scored against a rubric.
6. **Get results**: per-question feedback, which expected concepts you covered, and a prioritized study plan.

AI features use Google Gemini. Without a `GEMINI_API_KEY` the app still works end to end with deterministic fallbacks, and those scores are clearly labelled *approximate* in the UI.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, React Router, Framer Motion, Axios |
| Backend | FastAPI, SQLAlchemy 2, Alembic, Pydantic 2 |
| Database | SQLite by default; PostgreSQL supported via `DATABASE_URL` |
| AI | Google Gemini (`google-genai`, async, with timeouts and model fallback) |
| Auth | Email/password (bcrypt + JWT), optional Google Sign-In, private demo accounts |

## Quick start

**Prerequisites:** Python 3.11+, Node.js 20+.

### Backend

```bash
cd backend
python -m venv venv
# Windows: .\venv\Scripts\activate     macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then set SECRET_KEY (required) and optionally GEMINI_API_KEY
python main.py              # http://127.0.0.1:8000  (API docs at /docs)
```

On startup the backend applies database migrations automatically and syncs the role and company catalog. An existing SQLite database is backed up (`interview_prep.db.backup-<revision>`) before any migration runs.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:8000
npm run dev                 # http://localhost:5173
```

### Docker (single container, API + frontend)

```bash
docker compose up --build   # http://localhost:8000
```

Data is stored in the `prepsphere-data` volume. Secrets come from `backend/.env` at runtime and are never copied into the image.

## Configuration

Backend (`backend/.env`, see `backend/.env.example`):

| Variable | Required | Purpose |
| --- | --- | --- |
| `SECRET_KEY` | yes | Signs login tokens. Generate with `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `DATABASE_URL` | no | Defaults to `backend/interview_prep.db` (SQLite) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | no | Login lifetime, default 1440 (24 h) |
| `GEMINI_API_KEY` | no | Enables AI questions, evaluation and recommendations |
| `GEMINI_MODEL` / `GEMINI_FALLBACK_MODEL` | no | Default `gemini-3.6-flash`, falling back to `gemini-flash-latest` |
| `GOOGLE_CLIENT_ID` | no | Enables Google Sign-In (must match the frontend's `VITE_GOOGLE_CLIENT_ID`) |
| `CORS_ORIGINS` | no | Comma-separated allowed frontend origins |
| `DEMO_LOGIN_ENABLED` | no | "Try a demo" button; set `false` in production |
| `MAX_RESUME_MB` | no | Upload size limit, default 10 |

Frontend (`frontend/.env`): `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`. Never put secrets in `VITE_` variables; they are embedded in the public bundle.

## Testing

```bash
cd backend && pip install -r requirements-dev.txt && pytest
cd frontend && npm run lint && npm run build
```

The backend suite covers auth, resume upload and skill gaps, the full interview flow, AI fallbacks, the skill taxonomy, and migrations. It runs against a throwaway SQLite database with no API keys. CI runs the same checks on every push and pull request.

## Project structure

```
backend/
  main.py                    FastAPI app and all endpoints
  core/                      config, database, models, schemas, migrations runner, seed data
  services/
    gemini_service.py        question generation, rubric evaluation, recommendations (+ fallbacks)
    resume_intelligence.py   text extraction, contact info, structure, completeness
    jd_intelligence.py       job description requirements
    skill_taxonomy.py        skill catalog, aliases, evidence extraction, role-requirement matching
    skill_gap.py             weighted readiness and strong/developing/gap statuses
    candidate_profile.py     the active resume and the skills derived from it
  migrations/                Alembic migrations
  tests/
frontend/src/
  api/                       Axios client (auth header, session expiry) and session helpers
  pages/Dashboard.jsx        workflow state; one component per step in pages/dashboard/
  pages/LandingPage.jsx, Login.jsx, Signup.jsx
```

## API overview

| Method & path | Purpose |
| --- | --- |
| `POST /auth/signup`, `/auth/login`, `/auth/google`, `/auth/demo` | Authentication |
| `GET /roles`, `GET /companies` | Role and company catalogs |
| `POST /resumes/upload`, `GET /resumes`, `POST /resumes/{id}/select`, `DELETE /resumes/{id}` | Resume library (one resume is active) |
| `POST /jobs/analyze` | Extract requirements from a job description |
| `GET /skill-gaps?role_id=&jd_skills=` | Skill gap for the active resume |
| `POST /interviews`, `POST /interviews/{id}/answers`, `GET /interviews/{id}/results` | Mock interview |
| `GET /interviews/history`, `GET /recommendations` | History |

Interactive documentation is available at `http://127.0.0.1:8000/docs`.

## History

PrepSphere grew out of an earlier prototype, InterviewAI, which used LangGraph research agents, a JSON company registry and multi-round voice interviews. That code is no longer used by the app. It is preserved on the local branch `archive/interviewai-legacy` and in git history.

## License

MIT, see [LICENSE](LICENSE).
