# PrepSphere Frontend

React 19 + Vite single-page app. See the [root README](../README.md) for the full picture.

```bash
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:8000
npm run dev            # http://localhost:5173
npm run lint
npm run build
```

## Layout

| Path | Purpose |
| --- | --- |
| `src/config.js` | API base URL and Google client ID from `VITE_` variables |
| `src/api/` | Axios client (auth header, redirect to login when the session expires, readable API errors) and token storage |
| `src/components/layout/` | Signed-in shell: collapsible sidebar, top bar, shared user context |
| `src/components/ui/` | Toasts and tooltips |
| `src/pages/Dashboard.jsx`, `src/pages/dashboard/` | The Workspace flow: role, company, resume, skill gap, interview and results, one component per step |
| `src/pages/interview/` | Video interview: setup check, interview room (spoken, coding and whiteboard stages) and results; `lib/` holds media capture, speech, on-device recordings, face tracking and the room controller |
| `src/pages/profile/` | Profile page widgets, including the 3D skill sphere and linked profiles |
| `src/pages/showcase/` | Benchmarks, the resume showcase leaderboard, publishing with a live preview, and comparison |
| `src/pages/*.jsx` | Landing, login, signup, interviews, resumes, companies, skill gaps, study plan and settings pages |
| `src/styles/app.css` | Design tokens and shared `ps-` classes for the signed-in pages |
| `public/models/` | MediaPipe face model used by the video interview, served from the site |

Never put secrets in `VITE_` variables: they are compiled into the public JavaScript bundle.
