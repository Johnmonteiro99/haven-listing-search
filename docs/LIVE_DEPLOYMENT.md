# HAVEN live deployment

Deployed and publicly checked on 2026-10-24. This is a recruiter-facing demo of the original twelve-record sample dataset; property imagery remains illustrative.

## Verified addresses

- [Live demo](https://haven-listing-search.vercel.app/)
- [API health](https://haven-listing-search-api.onrender.com/api/health)
- [API reference](https://haven-listing-search-api.onrender.com/docs)

Production uses `deployment/production-readiness` in the existing repository. The application readiness commit is `4c72d468e47acbe5ebed3aaf9bd653071487da40`; later documentation-only commits do not change application behavior. The original `main` and development checkout remain separate.

## Configuration

| Setting | Vercel frontend | Render API |
| --- | --- | --- |
| Plan | Hobby/free | Free Python Web Service |
| Root | `frontend` | Repository root (blank Root Directory) |
| Runtime | Node 22.x | Python 3.14.5 via `.python-version` |
| Install | `npm ci` | `python -m pip install -r backend/requirements.txt` |
| Build | `npm run build` | Dependency installation only |
| Output/start | `dist` | `python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port "$PORT"` |
| Health | Public UI/API checks | `/api/health` |
| Release trigger | Push to production branch | Manual deployment |

Vercel includes files outside `frontend` in its Build Step, so TypeScript's dataset imports work. Only the static build is published. The app has no history-based router and needs no SPA fallback today.

Production configuration:

```text
Vercel: VITE_API_BASE_URL=https://haven-listing-search-api.onrender.com
Render: CORS_ALLOWED_ORIGINS=https://haven-listing-search.vercel.app
```

These are public origins, not credentials. The backend permits only the canonical frontend origin, GET requests and ordinary CORS preflight; credentials are disabled. Commit-specific deployment URLs and preview origins are not automatically allowed. Only Vercel's Production environment has the API setting; previews need explicit configuration before their builds and API access can work.

Render uses the tracked JSON dataset and validates it at startup. No database, persistent disk, paid instance, extra backend on Vercel, or keep-alive service was introduced. Local development keeps its existing Vite proxy without requiring environment variables. See [the deployment guide](DEPLOYMENT.md) for setup details.

## Verification

- 278 backend tests, 168 frontend tests, TypeScript checking, and production build passed before publication.
- Fresh npm full/production audits and Python requirements scans reported zero known vulnerabilities on the verification date.
- Public health, all twelve records, pagination, and sixteen full-response comparisons against the local API passed. Four invalid-query checks returned 422; CORS/preflight checks matched the configured allowlist.
- Public searches, combined city/price/bedroom/keyword/budget filtering, ranking, pagination, empty-result recovery, validation feedback, and listing details were exercised.
- Map tiles/markers/attribution loaded. Phone shared-location record selection and details worked.
- Desktop 1440px, tablet 768px, and phone 390px checks covered both themes without horizontal overflow. No browser console errors or broken loaded images were observed.
- 41 public image/script/style asset checks passed. The compiled frontend uses the actual Render origin.
- After over sixteen minutes without test API traffic, the public app loaded all twelve records without retry (visible within a 15.4-second observation window). Lifecycle logs did not show an automatic idle restart, so a true free-tier sleep/wake cycle is not claimed. A subsequent controlled Render restart produced a fresh server process at 7:20:57 PM EDT; the app recovered without retry or console/CORS errors (results visible within 38.6 seconds of initiating restart). The ten-second delayed explanation remains covered by the existing automated local tests; its appearance during a long automatic hosted sleep was not observed.

The earlier [production-readiness report](PRODUCTION_READINESS.md) is a historical Phase 1 snapshot. Local Chromium/axe checks passed there; this deployment check does not certify physical devices, other browser engines, or human screen-reader use. Public API failure was not induced by corrupting the feed or suspending the live service; existing error/retry/cancellation tests passed locally.

## Maintaining the demo

1. Keep changes on the dedicated production branch and review them before pushing. Run tests, a configured production build, dependency checks, and fresh vulnerability scans first. Keep credentials, local `.env` files, dependencies, and generated build artifacts out of Git.
2. Vercel automatically publishes frontend pushes from the tracked branch. Render auto-deploy is off: deploy the reviewed backend commit manually after backend changes. For coordinated API changes, keep compatibility and release the backend before the frontend that needs it.
3. Keep Render at repository root so `data/sample_listings.json` stays available. Use `$PORT`, no production reload, and the pinned Python runtime. Check that startup and `/api/listings` both succeed.
4. API origin changes require updating Vercel Production `VITE_API_BASE_URL` and rebuilding. Frontend origin changes require updating Render's exact CORS origins and restarting/redeploying. Do not add wildcard preview access.
5. After releases, check the public demo while signed out: health, a real search, filters, page two, details, maps/images, themes, and a narrow viewport. A homepage HTTP 200 alone does not verify the full stack.
6. Record the verified commit and environment values together. Code rollback does not restore environment settings automatically. Recheck API/CORS behavior after any dashboard rollback.
7. Render Free sleeps after 15 minutes without traffic and can take about a minute to wake. Free-tier usage and availability limits apply; an always-on upgrade needs separate approval. Do not add paid resources or artificial keep-alive traffic.
8. Preserve OpenStreetMap attribution and provider-compatible Referer behavior. External tile availability is outside the app's control.
9. Recency ranking uses the current UTC date, so scores change over time. Sample data and illustrative imagery should remain accurately described.
10. Update the ZAYVERSE portfolio link only after separate approval. The verified demo URL above is ready for that future task.
