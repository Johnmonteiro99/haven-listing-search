# Production readiness — 2026-10-24

## Scope and status

Prepared locally in `/Users/joao/Documents/Codex/haven-listing-search-public`, the clean public-repository checkout at the start of this phase. No commits, pushes, Vercel/Render services, paid resources, public deployments, or portfolio changes were made. The original development checkout and uploaded assets were left untouched.

This is code readiness with bounded local evidence, not a verified hosted release. No live frontend/API URL exists from this phase. Follow `DEPLOYMENT.md` only after explicit deployment approval.

## Changes

- Shared `frontend/src/api/config.ts` routes health and listings requests through `VITE_API_BASE_URL`. Price-distribution requests already reuse the listings API and inherit the same origin. Empty development configuration retains the existing relative `/api` proxy.
- Vite rejects missing, insecure, loopback, or non-origin production API configuration before producing a build. Runtime URL validation also protects direct API calls. Cancellation signals, query encoding, response validation, and error handling are unchanged.
- Backend `CORS_ALLOWED_ORIGINS` parses explicit origins, rejects wildcards, credentials, paths, malformed URLs and non-loopback HTTP origins, and deduplicates entries. Missing settings deny cross-origin access. GET only, no credential support; ordinary local proxied requests require no CORS settings.
- FastAPI lifespan validates the existing feed before serving requests. Invalid or missing data prevents startup. Existing per-request loading and safe 503 handling remain in place; health response and all API contracts are preserved.
- `DelayedLoadingNote` adds one cancellable ten-second timer, with a polite status explanation outside the busy results region. It makes no HTTP requests and resets on request changes. Existing skeletons, empty/error/retry states and state ownership remain intact, including the mobile Map view.
- Python 3.14.5 and Node 22 runtime pins, environment examples, security updates, deployment guide, and focused regression tests were added. No database, service SDK, routing library, or runtime architectural change was introduced.

## Dependency security

| Dependency | Before | Prepared version | Reason |
| --- | --- | --- | --- |
| Vite | 7.1.12 | 7.3.7 | Compatible patch within Vite 7 clears reported Vite advisories. |
| Vitest | 3.2.4 | 4.1.12 | 3.2.7 alone did not resolve mock-server/worker advisories. Minimum security-fixed 4.x tooling removes the vulnerable Tinypool dependency and patches the mocker. Existing tests pass without test-case migration. |
| FastAPI | 0.119.1 | 0.133.1 | Earlier supported releases constrain Starlette below security-fixed versions. This release supports the selected patched Starlette. |
| Starlette | resolved 0.48.0 | explicitly pinned 1.3.1 | Fixes the scanner-reported URL/Host, static-file, endpoint-dispatch, and form-parser advisories within FastAPI's declared dependency range. |
| pytest | 8.4.2 | 9.0.3 | First fixed release for CVE-2025-71176 temporary-directory handling. Test-only update; not installed on Render. |

Pydantic 2.12.3, Uvicorn 0.38.0, React, and all other direct application dependencies remain unchanged. Only security-required major transitions were kept; no forced audit fix or unsupported transitive override was used. Lockfile records the resolved frontend dependency changes.

Initial npm audit reported four affected packages (two critical, one high, one moderate). These were development-tool findings, not evidence that static production JavaScript was exploitable. The initial Python production scan returned 12 advisory records in Starlette, including duplicate IDs/aliases; those records should not be interpreted as 12 distinct vulnerabilities. Expanding the scan to development requirements also found the pytest advisory (duplicated by the advisory service).

Final scans on 2026-10-24:

- `npm audit`: **0 known vulnerabilities**, full frontend dependency tree.
- `npm audit --omit=dev`: **0 known vulnerabilities**, production-only frontend tree.
- `pip-audit -r backend/requirements.txt`: **0 known vulnerabilities** after FastAPI/Starlette changes.
- `pip-audit -r backend/requirements-dev.txt`: **0 known vulnerabilities** after pytest change; includes production requirements.
- `pip check`: no broken requirements.

Scanner installed in an isolated temporary verification environment, not added to the deployed app dependencies. Advisory checks describe the scanned versions/date, not a guarantee against unknown or newly disclosed vulnerabilities. Re-run before release. Do not expose development/test servers publicly.

Security references: [Vite advisories](https://github.com/vitejs/vite/security/advisories), [Vitest mocker advisory](https://github.com/advisories/GHSA-qxg6-89mg-rqv8), [Tinypool advisory](https://github.com/advisories/GHSA-85c8-ppgw-ccpr), [Starlette releases](https://starlette.dev/release-notes/), [pytest advisory](https://github.com/advisories/GHSA-6w46-j5rx-g56g).

## Verification

- Python **3.14.5**, pytest **9.0.3**: **278 backend tests passed** (262 original plus 16 deployment/CORS/startup tests).
- Node **22.23.4**, Vitest **4.1.12**: **168 frontend tests passed** (153 original plus 15 API-configuration/delayed-loading tests).
- Clean `npm ci` installation succeeded on Node 22 with zero reported vulnerabilities. TypeScript checking passed as part of `npm run build` and a separate check.
- Production build passed using an explicitly non-live example origin (`https://api.example.com`) to test configuration. That address is not a HAVEN deployment and must never be used for publishing/portfolio links.
- Build correctly rejected absent API configuration, HTTP loopback, and an origin containing `/api` as a path.
- Uvicorn started locally from repository root using `--app-dir backend --host 0.0.0.0 --port "$PORT"`, no reload. Its lifespan validated the feed. Real HTTP calls verified health, page 2 (12 total records/two page-2 records), permitted and denied CORS origins, and absent credential headers.
- Local Vite proxy on a temporary frontend port returned health and rendered results against the already-running development API on port 8000. The newly prepared backend was independently exercised on temporary port 8291; existing servers were not interrupted.
- Built frontend checked in local Chromium at **390, 768, and 1440px**, light and dark: page loading, pagination (ten then two records), no horizontal overflow, no uncaught page errors, **zero axe WCAG A/AA violations in all six checks**. Theme transition was allowed to finish before contrast measurements.
- Production-style HTTPS API selection checked in the actual compiled bundle: browser requests to the example API origin were intercepted locally and forwarded to the real prepared local API. This checks built URL behavior, JSON handling, CORS headers, and UI integration; it does not prove public DNS/TLS or hosting behavior.
- Delayed response check: note absent initially, visible after ten seconds, removed after response, exactly one listing request. Failure/retry check: initial 503 followed by successful manual Retry, exactly two requests; no automatic polling.
- Dataset SHA-256 unchanged: `e785664fb4bde1c5534be07fb13cd6be8fc6c4673bce141508b34bb9f06efe07`.
- Whitespace/diff validation passed. No unrelated source or uploaded asset changes.

## Remaining limitations

- Hosted Vercel/Render builds, public HTTPS/DNS, login-free access, real hosted CORS, actual Render sleep/wake behavior, and final demo URLs remain unverified because deployment is not authorized.
- Chromium/axe does not certify Safari/Firefox, physical devices, or human screen-reader behavior. Existing unit tests cover map/filter/details/focus flows; a full hosted interaction pass remains on the deployment checklist.
- Backend test tooling emits two non-failing deprecation warnings: Starlette's HTTPX test adapter and AnyIO's BlockingPortal alias. No application failure or outstanding scanner advisory resulted. A later maintenance update can address these without expanding this preparation phase.
- Backend transitive packages other than the security-critical Starlette remain resolved by pip from the pinned direct requirements; scans must be repeated after future fresh resolutions. There is no claim of a fully hashed Python lockfile.
- External map tiles depend on provider availability and usage policy. Keep attribution and Referer behavior. Their appearance may differ from the localhost Stadia tiles.
- Render Free may take approximately one minute to wake after 15 minutes idle; usage/availability limits still apply. No paid resource or artificial keep-alive was added.

## Changed files

All paths below are relative to the public checkout named above:

- `.python-version`
- `README.md`
- `backend/.env.example`
- `backend/app/config.py`
- `backend/app/main.py`
- `backend/requirements.txt`
- `backend/requirements-dev.txt`
- `backend/tests/test_production_readiness.py`
- `frontend/.env.example`
- `frontend/.nvmrc`
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/vite.config.ts`
- `frontend/src/vite-env.d.ts`
- `frontend/src/api/config.ts`
- `frontend/src/api/config.test.ts`
- `frontend/src/api/health.ts`
- `frontend/src/api/listings.ts`
- `frontend/src/components/DelayedLoadingNote.tsx`
- `frontend/src/components/DelayedLoadingNote.test.tsx`
- `frontend/src/components/SearchResults.tsx`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_READINESS.md`
