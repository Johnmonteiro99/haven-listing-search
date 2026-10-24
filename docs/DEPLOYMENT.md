# HAVEN deployment guide

Status: the initial deployment was approved and completed on 2026-10-24. See [verified live addresses, configuration, and maintenance](LIVE_DEPLOYMENT.md). This guide records the setup procedure; new paid resources, account permissions, and portfolio changes still require separate approval.

## Architecture and runtimes

- Vercel serves the static React/Vite build. Render runs FastAPI. The browser calls Render directly over HTTPS.
- Keep the tracked `data/sample_listings.json` unchanged. It contains 12 sample listings; property images are illustrative. No database, persistent disk, API key, or additional service is required.
- Python: **3.14.5**, pinned in repository-root `.python-version` and used for local verification.
- Node: **22.x**, set by `frontend/package.json` for Vercel. `frontend/.nvmrc` pins the locally tested patch **22.23.4**. Vercel controls patch updates within its selected major, so hosted verification remains necessary.
- Use `npm ci` to install the lockfile, including development dependencies needed by TypeScript and Vite. Render installs only `backend/requirements.txt`.

## Environment variables

| Variable | Where | Value |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Vercel project, Production environment | The actual Render HTTPS origin, without `/api`, query parameters, or credentials. |
| `CORS_ALLOWED_ORIGINS` | Render service | Comma-separated, exact frontend HTTPS origins. Use the actual Vercel production origin. |
| `PORT` | Render automatically | Assigned by Render; the start command reads it. Do not hardcode it. |

Neither configured URL is a secret. Every `VITE_` value is included in browser code; never put credentials there. A frontend environment change requires a new build/deployment. A backend origin change requires a restart/redeploy. Do not commit real credentials or `.env` files.

`frontend/.env.example` and `backend/.env.example` describe the settings. Vite reads frontend `.env.local`; Python does **not** automatically read backend `.env` files. Set backend variables in the shell or Render dashboard.

Production builds fail if the API origin is missing, non-HTTPS, loopback, includes a path beyond `/`, credentials, a wildcard, query, or fragment. Trailing `/` is normalized. Development without this variable still uses the existing `/api` proxy to `http://127.0.0.1:8000`.

Missing backend origins deny cross-origin browser access. The ordinary local Vite proxy still works without CORS settings. For direct browser-to-backend local testing only, explicitly allow `http://127.0.0.1:5173` and/or `http://localhost:5173`. HTTP is accepted only for loopback origins. Wildcard origins are rejected. Credentials are disabled, and only GET is allowed by CORS (middleware handles preflight OPTIONS).

CORS restricts browser access; it is not authentication. This intentionally public, read-only dataset remains accessible to non-browser clients. Preview frontend URLs are not automatically trusted: explicitly allow a particular preview origin if needed, or keep previews disconnected from the API. Do not allow all `*.vercel.app` domains.

## Local preparation checks

From the repository root, with the pinned Python and Node runtimes installed:

```sh
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements-dev.txt
npm --prefix frontend ci
backend/.venv/bin/python -m pytest backend
backend/.venv/bin/python -m pip check
npm --prefix frontend test
npm --prefix frontend exec -- tsc --noEmit -p frontend/tsconfig.json
```

For a production build, set `VITE_API_BASE_URL` to the real intended API origin before running `npm --prefix frontend run build`. Do not use a guessed live address. A placeholder such as `https://api.example.com` is only suitable for an isolated configuration test; it does not provide a working deployment.

Local development remains two processes:

```sh
# Terminal 1, repository root
backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
# Terminal 2, repository root
npm --prefix frontend run dev
```

Open `http://127.0.0.1:5173`. Local reload is for development only. Production must use the startup command below without `--reload`. Vite's preview server is only a local build check, not the production server.

## Manual deployment order — only after explicit deployment approval

1. Review and separately approve committing/pushing the prepared changes to the existing `Johnmonteiro99/haven-listing-search` repository. Connect the intended reviewed branch; preparation alone does not update GitHub.
2. Check account eligibility, usage limits, and the selected free tiers. Do not choose a paid instance, attach a database/disk, enable paid add-ons, or upgrade plans without explicit approval.
3. Create the Render backend and verify its actual API URL.
4. Create/configure Vercel with that API URL and obtain its actual stable production frontend origin.
5. Set Render CORS to that exact frontend origin and redeploy/restart. Then verify the complete application while signed out.

### Render: Python Web Service

Import the existing repository and select the approved branch.

| Setting | Exact value |
| --- | --- |
| Service type | Web Service |
| Language | Python |
| Root Directory | **Leave blank** (repository root) |
| Build Command | `python -m pip install -r backend/requirements.txt` |
| Start Command | `python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port "$PORT"` |
| Health Check Path | `/api/health` |
| Instance | Free, if approved and available |

Do not set Root Directory to `backend`: Render excludes files outside that directory, including the dataset. `.python-version` belongs at the repository root. Do not override it with a conflicting `PYTHON_VERSION` setting.

Set `CORS_ALLOWED_ORIGINS` once the actual Vercel production origin is known. Leaving it empty initially is safe: direct API health checks work, but cross-origin browser requests remain blocked.

Startup reads and validates every dataset record. A missing, malformed, or invalid dataset prevents startup rather than presenting a healthy-but-broken service. The endpoint still returns `{"status":"ok"}` once serving; it is a liveness check, not continuous dataset monitoring. Search retains safe 503 errors if the dataset later becomes unavailable. Logs contain diagnostics; public error responses do not expose file paths.

### Vercel: Vite project

Import the same repository/approved branch.

| Setting | Exact value |
| --- | --- |
| Framework Preset | Vite |
| Root Directory | `frontend` |
| Node.js version | 22.x |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Production environment variable | `VITE_API_BASE_URL` = actual Render HTTPS origin |

Enable **Include source files outside of the Root Directory in the Build Step** in the Root Directory settings. The current TypeScript build includes frontend tests that import `../data/sample_listings.json`; the shared dataset must be available during build. This does not publish the entire repository: only `frontend/dist` is served.

Use the stable production origin for CORS, not a commit-specific preview URL. Verify public production access without Vercel authentication/protection blocking recruiters. Keep secrets out of all frontend settings.

HAVEN currently has a single root page and section anchors, without history-based routing, so no SPA rewrite is needed. If client-side path routes are introduced later, add a fallback to `index.html` while preserving assets/API behavior. Vite's development API proxy is not used by the production build.

## Public verification checklist

Record the actual frontend and backend HTTPS URLs only after successful deployment. Do not replace the portfolio link during this phase.

- Open frontend in a signed-out/private browser: no login wall; correct HTTPS certificate.
- API `/api/health`: HTTP 200 JSON, `{"status":"ok"}`.
- API `/api/listings?page=1&pageSize=10`: HTTP 200, totalCount 12, ten records; page 2 contains two records with totalPages 2.
- Verify combined filters, budget ranking, validation errors, pagination, and no-result recovery against the API, not only mocked data.
- Verify frontend requests use the actual Render host, with no localhost calls or mixed content. Confirm permitted Origin gets the exact CORS response, unapproved Origin gets none, and POST preflight is denied.
- Verify Grid/Map, details, mobile filters, keyboard focus/retry, light/dark/system themes, desktop/tablet/mobile overflow, and root refresh/anchor navigation.
- Check image/font paths, lazy-loaded map code, browser console/network errors, map attribution, and external tile availability. Deployed maps intentionally use OpenStreetMap tiles; localhost uses Stadia tiles. Do not set a blanket `no-referrer` policy that prevents required tile Referer headers.
- Simulate API failure and a slow response: existing error/retry/cancellation remains; the subtle explanation appears after ten seconds, disappears after completion, and does not trigger polling or extra requests.
- Run automated accessibility checks, plus manual keyboard checks. Local Chromium/axe results do not certify physical devices, other browsers, or human screen-reader use.
- Let a free backend idle, reopen the public frontend, and confirm recovery after a real cold start. This hosted check cannot be completed locally.
- Record actual verified URLs and test date. Only then prepare the frontend URL for a separately approved portfolio update.

## Free hosting limitations

Render Free web services currently sleep after 15 minutes without inbound traffic; wake-up can take about one minute. The frontend remains available while the API wakes. Existing loading/retry behavior is preserved, with an additional note after ten seconds; there is no artificial polling or keep-alive service. Free service limits, availability, bandwidth/build allowances, and account eligibility must be checked at deployment. Free hosting does not guarantee immediate or continuous recruiter access.

The dataset is tracked read-only source, so an ephemeral filesystem needs no persistent disk. No uploaded or user-generated data is stored. Vercel Hobby has personal/non-commercial eligibility and usage limits; confirm suitability at deployment. No plan upgrades are authorized.

## Security preparation and remaining risks

See `PRODUCTION_READINESS.md` for dated scan results, dependency versions, verification scope, and residual operational risks. Re-run scans before deployment because advisories change. Do not publicly expose Vite development servers, Vitest watch/UI/API servers, or test runner ports. Serve only the static build plus Uvicorn API.

## Official references

- [Render FastAPI deployment](https://render.com/docs/deploy-fastapi)
- [Render monorepo/root directory behavior](https://render.com/docs/monorepo-support)
- [Render Python runtime selection](https://render.com/docs/python-version)
- [Render health checks](https://render.com/docs/health-checks)
- [Render Free limits](https://render.com/docs/free)
- [Vercel Vite](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel files outside Root Directory](https://vercel.com/docs/monorepos/monorepo-faq)
- [Vercel Node runtimes](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Vercel Hobby eligibility/limits](https://vercel.com/docs/plans/hobby)
- [Vite environment variables](https://vite.dev/guide/env-and-mode)
- [FastAPI CORS](https://fastapi.tiangolo.com/tutorial/cors/)
- [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/)
