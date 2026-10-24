# HAVEN — Listing Search Service

## Project Overview

HAVEN is a full-stack coding assessment that searches the supplied 12-listing JSON dataset through a real API-connected React interface. No database, credentials, or external service account is required for local development. Production uses explicit API-origin and CORS settings; see [the deployment guide](docs/DEPLOYMENT.md).

## Live Demo

[Open HAVEN](https://haven-listing-search.vercel.app/) · [API health](https://haven-listing-search-api.onrender.com/api/health) · [Live deployment and maintenance](docs/LIVE_DEPLOYMENT.md).

The free backend may take about a minute to wake after inactivity.

## Technology Stack

- **Backend:** Python, FastAPI, Pydantic, Uvicorn; pytest and HTTPX for tests.
- **Frontend:** React, TypeScript, Vite; Vitest, React Testing Library, and jsdom for tests.
- **Presentation:** CSS, local fonts and responsive image assets; axe-core for automated accessibility checks.
- **Data:** the original `data/sample_listings.json` file.

## Features

- Minimum/maximum price, minimum bedrooms, city, and description keyword filters.
- Target-budget and recency relevance ranking, with scores displayed on result cards.
- Server-side pagination with page navigation, loading, empty, validation, and retry states.
- Responsive desktop/mobile filters and persistent light, dark, or system appearance.

## Getting Started

Use Python 3.14.5 and Node.js 22.x with npm. Production preparation was verified with Python 3.14.5 and Node 22.23.4; runtime pins are included. Internet access is needed to install dependencies; fonts and images are local afterward.

Clone this repository and, from its root directory:

```sh
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements-dev.txt
npm --prefix frontend ci
```

Start the backend in terminal 1, from the project root:

```sh
cd backend
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Start the frontend in terminal 2, from the project root:

```sh
cd frontend
npm run dev
```

Open **http://127.0.0.1:5173**. Vite proxies `/api` to the backend on port 8000. Health is at **http://127.0.0.1:8000/api/health**, search at **http://127.0.0.1:8000/api/listings**, and interactive API documentation at **http://127.0.0.1:8000/docs**.

Both services must run. If port 5173 is occupied, use `npm run dev -- --port 5185` and open http://127.0.0.1:5185. Port selection is strict. On Windows, use `python` if necessary and replace `.venv/bin/python` with `.venv\Scripts\python.exe`; Windows has not been tested directly.

Example requests:

```sh
curl 'http://127.0.0.1:8000/api/health'
curl 'http://127.0.0.1:8000/api/listings?city=Springfield&maxPrice=500000&targetBudget=500000&pageSize=1'
curl 'http://127.0.0.1:8000/api/listings?city=Springfield&maxPrice=500000&targetBudget=500000&pageSize=1&page=2'
```

The filtered example returns MLS_A/A1 and MLS_B/B7 across two pages.

## Running Tests

From the project root:

```sh
backend/.venv/bin/python -m pytest backend
backend/.venv/bin/python -m pip check
npm --prefix frontend test
npm --prefix frontend exec -- tsc --noEmit -p frontend/tsconfig.json
npm --prefix frontend run build
```

The build also runs TypeScript checks before Vite. `npm run test:watch` from `frontend/` starts interactive tests. The production build produces static files and requires a valid `VITE_API_BASE_URL` HTTPS origin. See [deployment configuration](docs/DEPLOYMENT.md) before building; local development keeps the existing proxy without environment variables.

## Technology & Implementation Overview

```text
JSON Data → Pydantic Validation → Filtering → Relevance Scoring
→ Deterministic Sorting → Pagination → FastAPI Response → React Interface
```

`backend/app/repository.py` loads the dataset using a project-relative path, independent of the terminal directory. Pydantic validates records and query parameters. Small modules implement each search stage; `search.py` coordinates them and `main.py` exposes the HTTP endpoints. Responses contain `items`, `totalCount`, `page`, `pageSize`, and `totalPages`.

`frontend/src/api/` handles HTTP calls and response validation; `src/search/` manages draft filters and requests; `src/components/` renders the server's ranked page. React does not duplicate backend filtering or ranking. Tests live in `backend/tests/` and beside frontend source files. Configuration and pinned dependencies live in each application's directory.

## Relevance Scoring

With a target budget, relevance is **70% budget proximity + 30% listing recency**:

```text
budgetScore = 100 × max(0, 1 − abs(price − targetBudget) / targetBudget)
ageDays = max(0, referenceDate − listedDate)
recencyScore = 100 × max(0, 1 − ageDays / 180)
relevanceScore = 0.70 × budgetScore + 0.30 × recencyScore
```

Without `targetBudget`, relevance uses recency alone. One UTC reference date is used per request. Scores range from 0–100; full precision determines ordering, while cards display one decimal place. For MLS_A/A1 ($450,000, listed 2026-08-29), a $500,000 budget and reference date 2026-09-28 yield budget score 90, recency score 83.333…, and relevance **88**.

## Design Decisions and Trade-offs

- **Local JSON:** meets the supplied-data scope without database setup. The small dataset is loaded per search; large production feeds would need a different storage/query strategy.
- **Separate business modules:** filtering, scoring, ranking, and pagination remain independently testable and easy to change during an interview.
- **Composite identity:** `(source, id)` identifies a listing. Apparent duplicate properties from different feeds stay separate; pending and sold records are not silently removed.
- **Explicit matching:** filters use AND logic and inclusive numeric bounds. City is trimmed, case-insensitive, and exact; keyword is a case-insensitive description substring. Blank text means omitted.
- **Predictable ranking:** ties use newer listed date, then source and ID ascending. The 70/30 weights and 180-day window are explainable choices, not a learned model. Equal distances above/below budget receive equal penalties; future dates count as new. Budget affects ranking, not eligibility.
- **Validation:** negative/nonfinite prices, invalid bedrooms, inverted price bounds, nonpositive budget, and invalid page inputs produce clear errors. API invalid input returns 422; dataset failures return a generic 503. No matches return 200 with empty items and zero totals.
- **Pagination:** defaults are page 1 and 10 items. Users navigate pages in the UI; `pageSize` is API-configurable, with no UI size selector. Out-of-range pages return empty items with accurate totals.
- **Responsive interface:** mobile filters and both themes share search state. Property imagery is illustrative, not actual MLS photography. Supplied assets need no regeneration; Pillow scripts are optional development tools.

Development was assisted by **OpenAI Codex** for implementation, tests, documentation, and verification. The developer remains responsible for understanding, explaining, and modifying the submitted code.

## Additional Documentation

- [Deployment guide](docs/DEPLOYMENT.md): Render/Vercel settings, environment variables, cold starts, deployment order, and public verification.
- [Production readiness](docs/PRODUCTION_READINESS.md): current preparation, security scans, verification evidence, and remaining risks.

- [Interview preparation](docs/INTERVIEW_PREP.md): current-source walkthroughs, worked examples, practice changes and interview questions.
- [Codebase guide](docs/CODEBASE_GUIDE.md): detailed junior-friendly architecture, algorithms, and tests.
- [Final assessment audit](docs/ASSESSMENT_AUDIT.md): requirement-by-requirement evidence, verification, and limitations.
- [Requirements review](docs/requirements-review.md): assessment interpretation and decisions.
- [Design system](docs/DESIGN_SYSTEM.md) and [image assets](docs/IMAGE_ASSETS.md): presentation and asset provenance.
The supplied assessment PDFs and local submission ZIP are excluded from this public source repository.
