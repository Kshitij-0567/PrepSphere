# Backend Services

| Module | Responsibility |
| --- | --- |
| `gemini_service.py` | Async Gemini client (timeouts, JSON responses, fallback model). Generates interview questions, evaluates answers against a rubric, and builds study recommendations. Candidate-written text is wrapped in delimiters the model is told never to obey. Every method has a deterministic fallback labelled `source: "fallback"` / `evaluator: "fallback"`. |
| `resume_intelligence.py` | PDF/DOCX/TXT text extraction, contact and link detection, structured sections (Gemini or rule-based), completeness score and improvement tips. |
| `jd_intelligence.py` | Required vs. preferred skills, soft skills, experience and education from a job description. Unstated fields are reported as "Not specified", not guessed. |
| `skill_taxonomy.py` | Skill catalog and aliases; evidence-based extraction that avoids everyday-word false positives ("CV", "the rest of", "go live"); mapping from broad role requirements such as "Linux Internals & Bash" to concrete resume skills. |
| `skill_gap.py` | Weighted readiness score and strong / developing / minor gap / missing statuses. |
| `candidate_profile.py` | Tracks the user's active resume and keeps their resume-derived skills in sync with it. |

`intelligence_service.py`, `company_intelligence.py` and `memory_service.py` belong to the legacy InterviewAI prototype. They are not imported by the app and can be deleted.
