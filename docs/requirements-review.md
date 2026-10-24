# Assessment requirements review

Sources: all pages of `Instructions.pdf` (one page), `Coding_Test_Question_Paper.pdf` (two pages), and all 12 records in `../data/sample_listings.json` were read. PDF text extraction succeeded with warnings about malformed object offsets; no visual PDF review was performed because Poppler is unavailable.

## Full application requirements (deferred)
- Runnable backend API in Python, Go, or Java; required React UI. This project uses the user's chosen Python/FastAPI and React/TypeScript stack.
- Filters: minPrice, maxPrice, minBedrooms, city, and keyword matched against description.
- targetBudget and recency determine relevance; choose and explain a sensible scoring formula and trade-offs.
- Pagination with visible current results and controls to move between pages.
- Actual inputs for these values and results showing at least address, price, bedrooms, and relevance score.
- Reasonable loading, no-results, and error states. Deliberate invalid-input handling, including inverted price ranges and nonpositive pageSize. The handout mentions a city with no matches alongside invalid input examples, while also requiring a no-results state; clarify its intended treatment.
- Tests for core logic, no matches, tied scores, invalid filters, and pagination boundaries.
- Short README/comment explaining scoring and trade-offs when implemented.
- Independent-work addendum: complete the full application before the session, send code and README as a zip according to recruiter instructions, and bring a laptop/environment ready for demonstration and changes. Individual work; AI assistance is expressly allowed but must be explainable.

## Dataset characteristics and future edge cases
12 complete records, two feeds (7 MLS_A, 5 MLS_B), six cities, all in VA; 11 active and one pending. No sold example. ZIP values are strings; bathrooms include half values. Prices range from $399,000 to $610,000; bedrooms from 2 to 4. Dates range from 2026-07-28 to 2026-09-04.

IDs are unique in this sample but the specification guarantees uniqueness only within a source. Preserve `(source, id)` identity in future code.

Four apparent duplicate-property pairs: A1/B7, A2/B8, A3/B9, and A5/B11. Each pair shares coordinates and structural values but differs in price/date/description; address abbreviations vary and A2/B8 have different ZIPs. Deduplication is not a stated requirement.

Descriptions include positive and negative pet wording, so matching `pets` is not equivalent to determining pet permission. Free text is explicitly matched against descriptions, not all fields.

The sample does not exercise missing fields, invalid dates, repeated IDs across feeds, sold listings, or tied scores; future tests may need synthetic records. Consider range boundaries, fractional prices/bathrooms, zero or negative inputs, empty/whitespace strings, no matches, tied ranking, and pages beyond available results once semantics are decided.

## Assessment ambiguities and implementation decisions
- Scoring formula, weights, window, and future-date handling are chosen in Phase 3 below. The caller supplies an explicit reference date; Phase 5 uses today’s UTC date once per HTTP search request; Phase 4 establishes tie-breaking below.
- City/keyword matching: resolved for the engine in Phase 2 below; the handout does not prescribe the detailed semantics.
- Price/bedroom bounds are inclusive as specified in Phase 2; numeric validation was established in Phase 1.
- Phase 4 establishes one-based pagination, defaults of 1/10, no size maximum, and empty out-of-range pages with unchanged request metadata.
- Phase 5 resolves a valid unknown city as HTTP 200 with empty items and zero totals, as explicitly requested.
- Phase 2 explicitly includes all documented statuses; no active-only rule applies.
- Phase 2 explicitly preserves separate feed records without merging or deduplication.

Phase notes below record the state at each phase completion; later notes supersede earlier deferred-feature statements.

## Original foundation scope
Only `GET /api/health` returning `{"status":"ok"}` and a React shell displaying its loading, success, or failure state are implemented. The dataset remains untouched. Search, ranking, result display, and pagination are intentionally deferred by the current task.

## Phase 1 implementation update
Listing models, project-relative JSON loading, and search input validation are now implemented independently of HTTP routes. Pagination inputs default to page 1 and pageSize 10, with no upper cap; whitespace-only city/keyword filters become omitted filters. See `CODEBASE_GUIDE.md` for rules and trade-offs. Filtering, scoring, sorting, pagination execution, and search UI remain deferred. The other assessment ambiguities above remain unresolved.

## Phase 2 filtering semantics
The pure `filter_listings` engine uses AND logic across supplied filters. Price bounds and minimum bedrooms are inclusive. City matching is exact and case-insensitive after trimming surrounding whitespace on both sides. Keyword matching is a case-insensitive literal substring of description only. Python case folding supplies case-insensitive comparisons; internal whitespace is preserved. Existing model normalization treats blank text as omitted.

The function retains input order and all separate records, including matching pending/sold listings. It returns a new list without mutating records or input. Budget and pagination inputs are ignored. No matching city or keyword yields an empty list; how the future API represents that result remains undecided. These detailed semantics come from the Phase 2 request, not additional constraints inferred from the original handout.

Verified sample example: Springfield plus maxPrice 500000 returns MLS_A/A1 (450000) and MLS_B/B7 (452000); A2/B8 exceed the price cap. Scoring, sorting, pagination execution, API search endpoints, and React search remain unimplemented.

## Phase 3 scoring decisions
`calculate_relevance_score` independently scores a validated record using an explicit reference date. Budget proximity is `100 * max(0, 1 - abs(price - targetBudget) / targetBudget)`. Recency is `100 * max(0, 1 - age_days / 180)`, with `age_days = max(0, (as_of_date - listed_date).days)`. With budget, relevance is 70% budget proximity plus 30% recency; without budget, it is recency alone. The final score is bounded to 0–100 and never rounded by the scoring function.

The Phase 3 request chooses the weights and linear 180-day window; these are not prescribed by the assessment handout. Future dates count as new, and above/below-budget distances are treated symmetrically. Target budget remains a scoring preference, never a price cap. Validation remains in the existing models. No system clock, I/O, model mutation, or sorting occurs inside scoring.

On 2026-09-28 with budget 500000, A1 scores 88 and B7 scores approximately 87.94666667. Fixed-date tests make these examples reproducible. Sorting/tie-breaking, pagination execution, HTTP search endpoints, and React search remain unimplemented.

## Phase 4 ranking and pagination
Ranking calls the existing scoring function once per record, retaining full float precision. Sort priorities are relevance descending, actual listed date descending, source ascending, and ID ascending. Strings use ordinary case-sensitive ordering. Future dates retain their actual value for tie-breaking, even though scoring assigns age zero. Unique composite identities yield input-order-independent rankings; equal complete keys preserve stable input order. No merging or mutation occurs.

Pagination slices the complete ranked set using one-based page inputs validated through SearchParams. Defaults remain page 1 / pageSize 10 with no upper cap. Metadata records total_count, requested page, page_size, and total_pages. Zero matches has zero total pages. Requests beyond the last page return an empty list without changing the requested page or totals. These Python structures are not yet a public API response contract.

On 2026-09-28 with budget 500000, the Springfield/maxPrice 500000 example ranks A1 then B7; pageSize 1 gives two pages with one record each. Ranking priorities and pagination boundary behavior are choices specified in the Phase 4 request; the handout requires ranking/pagination but does not prescribe these details. Search HTTP endpoints and React functionality remain unimplemented.

## Phase 5 HTTP search contract
`GET /api/listings` binds the existing SearchParams model to camelCase query parameters: minPrice, maxPrice, minBedrooms, city, keyword, targetBudget, page, and pageSize. Defaults remain page 1 / pageSize 10. Invalid numeric inputs, bounds, and pagination return FastAPI's standard 422 detail responses. No matches returns HTTP 200 with empty items and zero totalCount/totalPages; out-of-range pages return 200 with accurate totals and the original requested page.

The independent search service executes load → filter → rank → paginate using the existing modules. The API selects one current UTC calendar date via an overridable dependency and passes it through ranking. Tests supply a fixed date. A second dependency chooses the dataset path so file-failure tests can use isolated files.

The explicit public response is `{items, totalCount, page, pageSize, totalPages}`. Every item contains all original listing fields, preserving listedDate and source/id, plus an unrounded numerical relevanceScore. Repository failures return HTTP 503 with a generic message; server logs retain exception/path details. No database, new dependencies, cache, deduplication, or React search UI is added. The production hosting arrangement remains outside this phase.
