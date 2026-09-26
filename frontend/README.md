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
| `src/api/client.js` | Axios instance: adds the auth header, redirects to login when the session expires, turns API errors into readable messages |
| `src/api/session.js` | Token storage and expiry check |
| `src/pages/Dashboard.jsx` | Workflow state and API calls |
| `src/pages/dashboard/` | One component per step (role, company, resume, skill gap, interview, results) plus shared pieces |
| `src/pages/LandingPage.jsx`, `Login.jsx`, `Signup.jsx` | Public pages |
