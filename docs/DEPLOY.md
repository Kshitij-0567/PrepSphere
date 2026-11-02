# Deploying PrepSphere

The frontend goes to **Vercel**; the API and its database go to **Render**.

The API does not run on Vercel. Vercel's serverless functions reject request
bodies above 4.5 MB, and PrepSphere accepts resumes up to 10 MB and interview
audio up to 16 MB, so resume upload and video interviews would fail there.
Render runs the existing `Dockerfile` as an ordinary long-lived container, which
has no such limit and allows the 30-second AI calls to finish.

Everything below is free. Follow the steps in order: each one produces a URL the
next one needs.

---

## 1. Push the repository to GitHub

Both hosts deploy from GitHub, so the code has to be there first.

```bash
git push origin main
```

## 2. Render: the API and the database

1. Sign in at <https://render.com> with GitHub.
2. **New → Blueprint**, pick the `PrepSphere` repository, **Apply**.
   `render.yaml` creates two things: the `prepsphere-api` web service and the
   `prepsphere-db` PostgreSQL database, already wired together. `SECRET_KEY` is
   generated for you.
3. The first Docker build takes about 5–10 minutes. When it finishes, copy the
   service URL, for example `https://prepsphere-api.onrender.com`.
4. Open `<that URL>/health`. It should return `{"status":"ok"}`.

The database starts empty. On first boot the app runs its migrations and loads
the 34 roles and 353 companies by itself.

## 3. Vercel: the website

1. Sign in at <https://vercel.com> with GitHub.
2. **Add New → Project**, import `PrepSphere`.
3. Set **Root Directory** to `frontend`. This matters: the repository root holds
   the backend, and Vercel must build only the React app.
4. Under **Environment Variables**, add:

   | Name | Value |
   | --- | --- |
   | `VITE_API_URL` | the Render URL from step 2, with no trailing slash |

5. **Deploy**. Copy the resulting URL, for example
   `https://prepsphere.vercel.app`.

## 4. Point the API back at the website

Until this step every request from the browser fails with a CORS error.

1. In Render, open `prepsphere-api` → **Environment**.
2. Set `CORS_ORIGINS` to the exact Vercel URL from step 3, with no trailing
   slash. Several origins are separated by commas and no spaces.
3. Save. The service restarts in about a minute.

## 5. Check it

Open the Vercel URL and confirm:

- the landing page loads and animates;
- **Sign Up** creates an account and lands on the profile page;
- the workspace lists 34 roles and the company page lists 353 companies;
- uploading a resume produces a skill gap with a readiness percentage.

---

## Optional settings

Add these in Render → `prepsphere-api` → **Environment**.

| Variable | What it changes |
| --- | --- |
| `GEMINI_API_KEY` | Without it, every AI feature uses its rule-based fallback and the interface marks those scores approximate. Get a key at <https://aistudio.google.com/apikey>. |
| `GOOGLE_CLIENT_ID` | Enables Google Sign-In. Must be the same value as `VITE_GOOGLE_CLIENT_ID` on Vercel, and the Vercel URL has to be listed as an authorised JavaScript origin in the Google Cloud console. |
| `GITHUB_TOKEN` | Raises the GitHub import limit from 60 to 5,000 requests an hour. |

## Things to know about the free tiers

- **Render sleeps the service after 15 minutes of no traffic.** The next visit
  takes roughly 50 seconds to wake it. Before a demonstration, open the site
  once to warm it up.
- **Render's free PostgreSQL expires after 30 days.** Upgrade it or create a new
  one before then, or the data goes.
- Rate-limit counters live in the service's memory. That is correct for a single
  instance; running several would need a shared store such as Redis.
- Pushing to `main` redeploys both hosts automatically.
