# Final assessment audit

Audit date: 2026-10-14. Both original PDFs were read completely: `Instructions.pdf` (1 page) and `Coding_Test_Question_Paper.pdf` (2 pages). This checklist distinguishes implemented behavior from verification limits. No feature, styling, dependency, or backend business-logic changes were made for this audit.

## Requirement-by-requirement evidence

Paths below are relative to the project root. Backend test filenames are under `backend/tests/`; frontend test paths are shown explicitly. All referenced suites passed during this audit.

| Requirement | Implemented and source evidence | Test evidence | Remaining gap or qualification |
| --- | --- | --- | --- |
| Python backend API | Yes: `backend/app/main.py` exposes FastAPI health and listing routes; `schemas.py` defines response contracts. | `test_health.py::test_health_returns_ok`; `test_listings_api.py::test_public_field_names_and_json_types`; live direct/proxied HTTP 200 checks. | None found for local assessment use. |
| React frontend | Yes: `frontend/src/main.tsx`, `App.tsx`, and `components/SearchPanel.tsx` mount a React/TypeScript application. | `frontend/src/App.test.tsx`; `frontend/src/search/search.test.tsx`; TypeScript and Vite build. | Other browsers and physical devices are not certified. |
| Minimum and maximum price | Yes: `backend/app/filtering.py` uses inclusive bounds; `frontend/src/components/SearchPanel.tsx` provides both inputs. | `test_filtering.py::test_filters_sample_records` includes individual bounds and equal min/max; `test_listings_api.py::test_query_filters_are_applied_through_real_pipeline`; frontend test “loads defaults, submits all six criteria once, and clears to defaults”. | None found. |
| Minimum bedrooms | Yes: `filtering.py`, `models.py`, and `SearchPanel.tsx` implement validated inclusive minimum. | Parameterized sample/API filter tests above; `test_models.py::test_search_rejects_invalid_values_with_field_errors`. | None found. |
| City filtering | Yes: `filtering.py` compares trimmed case-insensitive exact city names; `models.py` normalizes query whitespace. | `test_filters_sample_records`; `test_trims_listing_city_without_changing_it`; `test_unicode_case_insensitive_matching`; live mixed-case/whitespace query. | Exact city matching is a documented interpretation; no fuzzy matching. |
| Description keyword | Yes: `filtering.py` searches only description with case-insensitive substring matching; `SearchPanel.tsx` exposes the input. | `test_filters_sample_records` covers partial words, case, and nonmatching address/city text; live `ITCHEN` query returns A2/B8. | No tokenization or semantic matching; not required. |
| Target-budget ranking | Yes: `backend/app/scoring.py` applies 70% budget proximity and 30% recency; target budget is an optional UI input. | `test_scoring.py::test_requested_weighted_example_is_88`; `test_listings_api.py::test_budget_changes_ranking_without_filtering_results`; frontend weighted explanation test. | Weights are a design choice, not assessment-prescribed constants. |
| Listing recency ranking | Yes: `scoring.py` uses a 180-day linear decay; `ranking.py` orders by score and deterministic ties. Without budget, recency has full weight. | `test_scoring.py::test_recency_without_budget`, `test_missing_budget_uses_full_recency_weight`; `test_ranking.py::test_missing_budget_ranks_by_recency`. | Scores change with UTC date; tests inject a fixed date. |
| Pagination | Yes: `backend/app/pagination.py` slices ranked results; `frontend/src/components/Pagination.tsx` provides page navigation. | `test_pagination.py` boundary/coverage tests; API `test_multiple_pages_cover_all_ranked_results`; frontend “navigates real API pages with active criteria, ignores draft edits, and resets on search”; live 10+2 result pages. | UI fixes size at 10; API accepts pageSize. The handout requires page navigation but does not explicitly require a size selector. |
| Real API-connected results | Yes: `frontend/src/api/listings.ts`, `search/useListingSearch.ts`, and `vite.config.ts` connect relative requests to FastAPI; `SearchResults.tsx` renders responses. | API pipeline tests; frontend request/response tests; live proxy requests; Chrome displayed actual Manassas listing A6 at $415,000 with 3 bedrooms. | Frontend unit tests mock fetch; live HTTP/browser checks provide separate integration evidence. |
| Relevance score and required fields displayed | Yes: `frontend/src/components/ListingCard.tsx` renders address, price, bedrooms, and score out of 100. | `frontend/src/search/results.test.tsx`: “renders actual listing values, formatted dollars, fractional bathrooms and score”; browser showed score 63.9 for A6 on audit date. | Display rounds to one decimal; sorting uses full precision. |
| Loading, empty, error states | Yes: `SearchResults.tsx`, `SearchPanel.tsx`, and `useListingSearch.ts` render loading feedback, no matches, errors, and retry. | `results.test.tsx`: accessible loading, empty action, request errors/retry, out-of-range recovery; `App.test.tsx` failure/retry. API no-match test and live unknown-city request. | Live forced network failure was not repeated in this audit; automated coverage passed. |
| Invalid input handling | Yes: `backend/app/models.py`, `main.py`, `frontend/src/search/filters.ts`, and `api/listings.ts` provide client feedback and structured HTTP errors. | `test_models.py`; API `test_invalid_query_is_standard_422` and `test_range_error_names_both_bounds`; frontend validation/422 tests; live pageSize=0, inverted price range, budget=0, bedrooms=-1 each returned 422. | Repository failures return generic 503 while logging details; tested with missing/malformed/invalid files. |
| Core logic tests | Yes: `backend/tests/test_repository.py`, `test_filtering.py`, `test_scoring.py`, `test_ranking.py`, `test_pagination.py`, `test_search.py`, and API tests. | Full pytest run: 262 passed. | None found for specified core logic. |
| Edge-case tests | Yes: no matches, ties, invalid inputs, pagination limits, blank text, future dates, duplicate-looking feed records, malformed data, stale responses. | `test_ranking.py` tie tests; `test_pagination.py::test_page_boundaries_and_metadata`; `test_repository.py`; frontend stale-response and state-preservation tests. | Automated coverage is not a guarantee against every possible defect. |
| README and scoring explanation | Yes: root `README.md` documents setup, stack, workflow, formula, worked example, trade-offs, and Codex assistance. `docs/CODEBASE_GUIDE.md` gives deeper explanations. | Formula cross-checked with `scoring.py` and fixed-date 88-point test; setup, tests, and build verified from an extracted archive. | Python 3.14.5 / Node 26.0.0 / macOS verified; other supported versions and Windows not directly exercised. |

## Data and identity

`backend/app/models.py` represents all supplied fields with external JSON names preserved. `repository.py` validates all 12 records and deliberately reports malformed or missing data. Identity is `(source, id)`; records are not merged. `test_models.py` covers required fields/types/statuses, and `test_repository.py` covers all sample records, cross-source identities, file errors, and working-directory independence. The Springfield + maxPrice=500000 example returns MLS_A/A1 and MLS_B/B7.

## Verification results

- Full backend suite: **262 passed**, one nonblocking Starlette/AnyIO deprecation warning.
- Full frontend suite: **53 passed** across six files.
- Standalone TypeScript check and production build: passed.
- Direct API (`127.0.0.1:8000`) and frontend proxy (`127.0.0.1:5185`): health, each filter, combined budget search, pagination, empty results, out-of-range pages, and invalid-input responses passed.
- Chrome: live results observed in dark and light themes; switching to light retained the current Manassas filter and result. Automated tests additionally cover theme persistence, system restoration, and preservation of draft filters/page/cards.
- README installation/test/build commands checked on the extracted ZIP, using a fresh Python virtual environment and `npm ci`. Dependencies and build output remain outside the archive.
- Archive inspected for required source/config/data/docs/assets, root README, safe paths, unwanted files, and common credential patterns. Integrity checked with ZIP CRC and byte comparison to source files.

## Submission and limits

The archive contains one `haven-listing-search/` directory with README, backend, frontend, data, and documentation. It excludes dependency installations, virtual environments, caches, build output, Git metadata, temporary verification files, and environment files. Image originals are retained alongside optimized derivatives because the documented optional image scripts use them; no generated screenshots or test reports are included.

No blocking assessment gap was found. No new functionality or automatic submission is authorized. Production deployment, browser/device certification, and a UI page-size selector are not claimed. The candidate must still be ready to explain and modify the code during the live session.

Submit `haven-listing-search.zip` through the recipient/channel specified by the recruiter before the session. The original instructions leave the exact channel and deadline to the recruiter; this repository does not supply those details. Bring the laptop with both services available to run. No email, upload, or Git commit was performed by this audit.
