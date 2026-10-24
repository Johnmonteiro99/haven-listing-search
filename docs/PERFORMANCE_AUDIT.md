# HAVEN performance, stability and regression audit

Audit date: 2026-10-20. Scope: the existing showcase application, local production preview, and minimal evidence-led corrections. No feature development, redesign, API-contract change, dependency upgrade, commit or ZIP replacement was performed.

## Baseline and environment

- Branch: `feature/haven-showcase`; HEAD: `1c7bdd1` (`chore: checkpoint verified property exploration and map showcase`). The starting worktree had 58 status entries, including earlier modified/untracked showcase work. These are not audit changes.
- Captured SHA-256 hashes for 161 tracked/untracked source and asset files before testing in `/tmp/haven-audit-baseline.json`; starting status is `/tmp/haven-audit-status.txt`.
- Submitted ZIP SHA-256: `099f6d3bb3a3731f20e562b45ce5d56c428dc5b10d733455478c3b962a3d4858`.
- macOS 27.0; Node 26.0.0; npm 11.12.1; Python 3.14.5; Google Chrome 155.0.8059.85, headless, controlled through the existing external Playwright installation. Axe 4.14.0 is already a project dev dependency. No audit dependency was installed.
- Production build served by `vite preview` on `127.0.0.1:5190`, proxying `/api` to the existing FastAPI server on port 8000. The development live view on port 5185 and other existing servers were left running.
- React/React DOM 19.2.0; React Leaflet 5.0.0; Leaflet 1.9.4; TypeScript 5.9.3; Vite 7.1.12; Vitest 3.2.4; plugin-react 5.0.4; Inter/Playfair font packages 5.3.0.
- FastAPI 0.119.1; Pydantic 2.12.3; Uvicorn 0.38.0; Starlette 0.48.0; pytest 8.4.2; httpx 0.28.1; AnyIO 4.15.1. `npm ls --depth=0` and `pip list --format=json` recorded installed versions, rather than assuming the requirements files describe every transitive dependency.

## Automated baseline

| Check | Result |
| --- | --- |
| Backend `.venv/bin/python -m pytest -q` | **262 passed, 0 failed**; one Starlette/AnyIO `BlockingPortal` deprecation warning |
| Frontend `npm test` | **141 passed, 0 failed**, 19 test files |
| Frontend `npx tsc --noEmit` | Passed |
| Frontend `npm run build` | Passed; 115 modules transformed |
| Backend `.venv/bin/python -m compileall -q app tests` | Passed |
| Backend `.venv/bin/python -m pip check` | No broken requirements |
| Frontend `npm ls --depth=0` | Passed; no missing/invalid direct dependency reported |
| `git diff --check` | See final preservation verification below |
| Production `/api/health` | HTTP success, `{"status":"ok"}` |

The backend warning is dependency deprecation, not an application-test failure. pip also reported that its normal cache directory was unwritable in the sandbox; checks completed without using that cache.

## Browser journeys and accessibility

All feature scripts ran against **the production preview**, using real local API responses. Repeatable map suites intercepted provider tile requests with small image fixtures. A separate unmocked tile check verified live provider availability.

| Script | Verified cases / coverage |
| --- | --- |
| `check_advanced_filters.cjs` | 14 width/theme cases, plus short-height sheets; Apply, Cancel/Escape, Reset, invalid inputs, exact combined queries, empty Map, focus containment/restoration, Auto theme and reduced motion |
| `check_sticky_search.cjs` | 12 width/theme cases; observer visibility, shared city draft, native Enter/Search, page reset, preserved criteria/view, no duplicate main search, map clearance and keyboard focus |
| `check_map_explorer.cjs` | 12 width/theme cases; Grid/Map, grouped coordinates, marker/card identity, featured property, details, focus restoration, selection/camera preservation, pagination, keyboard pan/zoom and reduced motion |
| `check_atlas.cjs` | 12 width/theme cases; sticky geometry, exposed controls, fitting, dragging and responsive resizing |
| `check_ui_polish.cjs` | 12 width/theme cases; bedroom stepper, validation, card layout and map geometry |
| `check_price_distribution.cjs` | 12 width/theme cases; real 12/4/2-record distributions, empty results, both slider keys and drags, precise values, selected/excluded fills, no price-edit fetches, reduced motion |
| `check_footer_blend.cjs` | 12 width/theme cases; compact geometry, rotation/progress, pause/resume, keyboard selection, touch, reduced motion and stable theme-switch dimensions |
| `check_card_interactions.cjs` | Both desktop themes and eight touch width/theme cases; hover, focus, Enter/Space, image activation, no duplicate opening/request, reduced motion |
| `check_property_details.cjs` | 10 width/theme cases; actual API fields, dialog containment, theme switching, keyboard activation, Escape, visible focus and restoration |
| New `check_audit_journeys.cjs` | 18 supplemental checks: 12 states at 320×568 in both themes, four error/retry cases, delayed stale-response protection, and tile-failure recovery; additionally nine map mount/unmount cycles |

The combined responsive coverage includes **320, 375, 390, 768, 1024, 1280 and 1440px**, light and dark. The advanced panel also passed 320×568, 375×667 and 768×600 short-height checks. Screenshots were inspected at the narrowest width for capsule, details and featured content; the feature suites retain screenshots for their other sizes.

- No horizontal document overflow or clipped dialog detected in these checks. Existing fixed modal actions, independent content scrolling and 44px capsule targets remain usable.
- Grid, filters, property dialogs, footer and capsule audits produced no Axe WCAG-tag violations. Map audits continue to report `target-size` for overlapping nearby geographic pins. The tests retain and explicitly identify those findings; they are not evidence of complete WCAG conformance. Equivalent property cards remain accessible.
- Keyboard labels, visible focus, native modal semantics, Escape, focus restoration, shared-coordinate chooser and reduced-motion controls passed automated browser checks. Auto appearance responded to system changes while filters were open.
- Loading appeared during a delayed search. A newer Springfield response remained visible after an obsolete delayed Boston response completed. HTTP 500, network failure, malformed successful JSON and HTTP 422 all exposed recovery UI and succeeded after Retry.
- No unhandled page exception was observed. Supplemental console errors occurred only during deliberately injected network/500/422/tile failures; aborted stale requests were expected. Normal performance loads had no failed request or HTTP error. These error messages were not suppressed in application code.
- Live Stadia light and dark layers each loaded 12 tiles with HTTP 200, no page exception, and visible Leaflet/Stadia/OpenMapTiles/OpenStreetMap attribution. This is one local connectivity check, not a provider uptime guarantee. Forcing both themed and fallback providers to fail retained explanatory status, markers and card selection.

## Performance method and baseline measurements

`check_performance.cjs` uses Chromium PerformanceObserver and CDP. Lighthouse was not installed; no Lighthouse score or TTI-derived TBT is claimed.

Each sample uses a fresh browser context, disabled browser cache, a cold navigation, no input until five seconds after `load`, and actual local API data. Three samples were collected for each profile/theme (12 total), with other audit browser runs finished first. The local machine and backend were not dedicated benchmark infrastructure.

- Desktop: 1440×900, DPR 1, no network/CPU throttle.
- Mobile: 390×844, DPR 3, touch/mobile emulation, **4× CPU slowdown**, **150ms latency**, **1.6Mbit/s download**, **750Kbit/s upload**. This emulates constraints; it is not a physical phone.
- CLS uses the maximum session window (1s gap / 5s window), excluding recent-input shifts.
- Blocking-time proxy sums `max(long-task duration − 50ms, 0)` after FCP until the observation ends. This fixed-window value is **not Lighthouse TBT**. No long tasks were recorded during any baseline observation, so the proxy is zero.
- Keyboard latency is actual Playwright key dispatch, measured from the browser keydown listener through the second animation frame. It is a small lab interaction sample, **not real-user INP**. The separate synthetic draft-update measurement is retained in raw evidence but is not presented as INP either.

Median baseline values:

| Profile / theme | FCP | LCP | CLS | Blocking proxy | Transfer bytes | Keydown → second frame |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Desktop light | 76ms | 76ms | 0.000699 | 0ms | 660,360 | 60.0ms |
| Desktop dark | 64ms | 72ms | 0.000699 | 0ms | 657,390 | 60.0ms |
| Mobile light | 932ms | 3,632ms | 0.000396 | 0ms | 608,560 | 57.4ms |
| Mobile dark | 928ms | 3,680ms | 0.000396 | 0ms | 616,574 | 58.0ms |

The LCP element was the selected theme's hero image. Mobile DPR 3 selected the 1672px candidate (172,010B light / 180,024B dark), which is valid for the responsive source set. Light mobile also fetched two native-lazy property candidates (104,834B and 150,218B) within Chromium's preload distance. These shared the initial network window with the hero and fonts. There is no evidence that React computation is the dominant bottleneck. Image requests varied slightly between desktop samples due to native lazy-load scheduling; the transfer numbers are observed resource timings, not a claim that all sessions download an identical set.

### Production assets

| Asset | Raw size | Vite-reported gzip size |
| --- | ---: | ---: |
| Initial JS | 246.91kB | 76.34kB |
| Deferred Leaflet/Map JS | 161.36kB | 47.50kB |
| Initial CSS | 55.57kB | 11.01kB |
| Deferred Map CSS | 15.61kB | 6.46kB |
| Inter Latin variable font | 48.26kB | WOFF2 already compressed |
| Playfair Latin variable font | 38.40kB | WOFF2 already compressed |

Browser resource timings confirm compressed initial JS/CSS delivery (76,339B / 11,011B encoded bodies); a plain curl HEAD without `Accept-Encoding` does not represent the browser's compressed transfer. Grid performed exactly one main listing request and loaded **no Map chunk, Map CSS or provider tiles** in all baseline samples.

All delivered property/hero/footer/filter images use existing WebP derivatives; fonts are local WOFF2 with `font-display: swap`. Hero uses eager/high priority, cards/footer use native lazy loading and async decoding, details decode asynchronously, and image frames reserve geometry. ThemeImage retains decoded scenes for later fades, avoiding repeated theme downloads once cached. No broken local asset was observed. Original PNGs remain in `public` and are copied into the build (30.81MB); they were not requested during these initial-load samples. The complete dist is about 33.47MB on disk, not the initial page transfer.

## React, map and animation inspection

- One `useListingSearch` owns applied searches. AbortController cleanup and an aborted-signal guard prevent stale success/error updates. Draft typing does not fetch. Tests verify exact query parameters and single submission requests.
- Price distribution uses a separate, debounced 300ms, cancellable collection. Only membership criteria restart it, not price bounds or ranking-only budget. It is bounded at 100 sequential pages of 10 records and validates consistent totals and unique identities. No unbounded fetching was found.
- Leaflet is dynamically imported only in Map mode. The same map DOM node survives theme changes; only its tile layer changes. Selection does not refit or fetch. Leaving Map unmounts it intentionally; returning creates a fresh map under the existing view contract.
- Nine Grid/Map/theme cycles followed by forced GC retained one document, **1,283–1,285 DOM nodes** and **333–335 listeners** after returning to Grid. Heap grew from 4.87MB to 5.47MB during warming; this short sample does not prove absence of all retained memory. No accumulating map containers/listeners or functional degradation was found.
- ResizeObserver, IntersectionObserver, requestAnimationFrame, media listeners, modal scroll locks, request aborts and main timers have corresponding cleanup. MapControls' DOM-bound Leaflet listeners live on a removed toolbar; warmed listener counts did not accumulate.
- Histogram building and page-level marker grouping are small/bounded; no measured expensive render justified adding memoization. No React.memo/useMemo/useCallback blanket changes were made.
- Footer progress causes local component updates every 100ms, pauses on hidden document/hover/focus as designed, and clears its interval. It continues while merely offscreen in a visible tab: an optional future efficiency improvement, not an observed long-task problem.
- Main reveal/hover motions use opacity/transform. Histogram disclosure animates height within its modal, and the footer uses localized backdrop blur; these are potential layout/paint costs, but existing checks and load observations did not demonstrate a problem warranting a rewrite. Reduced-motion checks passed. No whole-page image/theme layout shift regression was detected.

## Prioritized findings

| Severity | Finding | Disposition |
| --- | --- | --- |
| P0 | No blocking/data-loss issue reproduced | No corrective application change required |
| P1 | No functional regression reproduced | Existing search/map/dialog contracts retained |
| P2 | Throttled mobile hero LCP ~3.6–3.7s; image/font network competition | Small image-priority experiment recorded below; larger delivery/source-set changes need a separate review |
| P2 | Dependency advisory debt | Separate coordinated dependency update and full retest recommended; no automatic major/transitive upgrades |
| P2 | Nearby map-pin target overlap reported by Axe | Existing finding; zoom/accessible cards available. Clustering or displacement changes interaction design and is outside this minimal audit |
| P3 | Original PNGs copied to dist, although not fetched by the app | Packaging optimization only; preserve originals and submitted ZIP |
| P3 | Footer updates while offscreen; one backend dependency deprecation warning | No measured application bottleneck/failure; avoid speculative changes tonight |

### Dependency advisory details

`npm audit --json` reported **four affected development-package nodes: two critical, one high, one moderate** (Vitest, tinypool, Vite, @vitest/mocker). These are registry severities, not four reproduced exploits in HAVEN. `npm audit --omit=dev --json` reported **zero production npm advisories**. Vite's server is bound to loopback; the tests use `vitest run`, not an exposed Vitest UI server. Do not treat these conditions as a substitute for updates.

Relevant registry links include [Vitest UI server](https://github.com/advisories/GHSA-5xrq-8626-4rwp), [mock redirect](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), [tinypool options](https://github.com/advisories/GHSA-85c8-ppgw-ccpr), and [Vite dev-server WebSocket](https://github.com/advisories/GHSA-p9ff-h696-f583). The registry's suggested direct fixes do not establish that every transitive advisory is resolved; re-audit the resolved lockfile after a reviewed update.

A read-only check of public PyPI version metadata covered **22 installed packages**, with no lookup failures. It found advisories on **pip 26.1.1 (2 unique GHSA IDs), pytest 8.4.2 (1), and Starlette 0.48.0 (6)**. Duplicate PYSEC aliases were not counted as additional issues. This is an advisory lookup, not a full exploit/security audit. pip/pytest findings concern installer/test environments. Starlette findings concern file-range processing, Windows static paths, HTTPEndpoint dispatch, URL reconstruction and form parsing. HAVEN currently exposes JSON GET health/listings endpoints and does not use StaticFiles/FileResponse, HTTPEndpoint subclasses, form parsing or URL-based authorization. Source inspection did not identify the stated affected usage paths in HAVEN; no exploit was attempted.

Review [Starlette's Range handling](https://github.com/advisories/GHSA-7f5h-v6xp-fcq8), [Host reconstruction](https://github.com/advisories/GHSA-86qp-5c8j-p5mr), [path reconstruction](https://github.com/advisories/GHSA-jp82-jpqv-5vv3), [form limits](https://github.com/advisories/GHSA-82w8-qh3p-5jfq), [Windows static files](https://github.com/advisories/GHSA-wqp7-x3pw-xc5r), and [endpoint dispatch](https://github.com/advisories/GHSA-x746-7m8f-x49c) before any hosting expansion. Resolving the full set involves a FastAPI/Starlette compatibility review, not blindly overriding a transitive pin. That larger change is deferred for approval.

## Reproduction and evidence

### Changes and measured experiment

Added this report and two standalone browser scripts: `frontend/scripts/check_audit_journeys.cjs` and `frontend/scripts/check_performance.cjs`. **No application correction was retained.** No P0/P1 regression or small P2 fix with demonstrated benefit was found. `CODEBASE_GUIDE.md` was not changed by this audit because final application behavior is unchanged.

Tested a one-attribute `fetchPriority="low"` hint on the existing lazy listing images, after identifying overlapping initial image transfers. The production build and all 141 frontend tests passed with the experiment. Six new isolated mobile samples under the same conditions produced these medians:

| Theme | Baseline LCP | Experimental LCP | Difference |
| --- | ---: | ---: | ---: |
| Light | 3,632ms | 3,644ms | +12ms |
| Dark | 3,680ms | 3,692ms | +12ms |

No benefit was demonstrated, so the exact attribute change was removed and the original file hash restored. The difference is small and should not be interpreted as a statistically established regression. Evidence: `haven-performance-a6acqf`. Do not adopt this optimization based only on intuition. A future mobile-image experiment should examine critical image discovery and responsive delivery while explicitly preserving crop/quality and avoiding duplicate preload requests.

### Commands

From `backend/`: `.venv/bin/python -m pytest -q`, `.venv/bin/python -m compileall -q app tests`, `.venv/bin/python -m pip check`, `.venv/bin/python -m pip list --format=json`.

From `frontend/`: `npm test`, `npx tsc --noEmit`, `npm run build`, `npm ls --depth=0`, `npm audit --json`, `npm audit --omit=dev --json`, `npm run preview -- --host 127.0.0.1 --port 5190 --strictPort`.

From the project root, run each browser script in the table using the existing external Playwright installation:

```sh
HAVEN_BASE_URL=http://127.0.0.1:5190 \
NODE_PATH=/Users/joao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
node frontend/scripts/check_audit_journeys.cjs

HAVEN_BASE_URL=http://127.0.0.1:5190 \
NODE_PATH=/Users/joao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
node frontend/scripts/check_performance.cjs
```

`HAVEN_PERF_PROFILE=mobile` selects only mobile measurements. Do not run performance samples alongside the other browser suites. Each script prints its evidence directory. Test runner paths are local tooling, not application dependencies.

The audit also used `git status --short`, `git branch --show-current`, `git log -4 --oneline`, `git diff --check`, curl health/asset checks, source inspection and SHA-256 preservation checks. PyPI metadata was queried read-only at `https://pypi.org/pypi/<installed-name>/<installed-version>/json`. No package installation or dependency file change was made.

Evidence folders under `/var/folders/cf/kg_dtnr967g3ts28z71qg7mm0000gn/T/`:

- `haven-filters-mgfWr0`, `haven-capsule-8Ch7F9`, `haven-map-2ZhFB6`
- `haven-footer-MfzH4z`, `haven-price-distribution-wEfxT0`, `haven-atlas-Cs0K9Y`
- `haven-polish-niQkNQ`, `haven-cards-J00xx7`, `haven-details-GCQ5rD`
- `haven-audit-journeys-3OlMP2`, `haven-performance-KJEvbC` (baseline)
- `haven-performance-a6acqf` (discarded image-priority experiment)

Dependency reports: `/tmp/haven-npm-audit.json`, `/tmp/haven-npm-production-audit.json`, `/tmp/haven-python-advisories.json`. Live tile report: `/tmp/haven-live-tiles.json`. These are temporary evidence and may be cleaned by the operating system; the results above and reproducible scripts are the durable record.

## Remaining manual QA

Tomorrow, prioritize a real iPhone/Android session with the virtual keyboard open, Safari/Firefox dialog and slider behavior, VoiceOver/NVDA reading/focus announcements, and live map pan/zoom/selection on the interview network. Check a full search → filter → map → details → theme → back journey at browser zoom 200%. Automated Chromium/Axe results are not physical-device, cross-browser or human screen-reader certification. This audit does not establish hosted-service behavior or real-user performance percentiles.

## Final verification and preservation

After removing the unsuccessful experiment, reran the complete frontend suite (**141/141**), standalone TypeScript, production build, backend suite (**262/262**, same one deprecation warning), and Python compilation. All passed. The rebuilt production assets returned to the baseline filenames/content (`index-B1IEVd7M.js`, `ListingMap-CYE2u-vZ.js`). The running production preview returned health `ok` and the actual Springfield query returned four records on page 1.

`git diff --check`, new-file whitespace checks, and `node --check` for both new scripts passed. All **161 pre-existing file hashes matched the starting snapshot**, including every existing source/document, image asset, dependency file, backend/data file and the submitted ZIP. Only the three audit files named above were added. No user work was reset, staged, committed, pushed or overwritten. The showcase branch remains unchanged, and the separate production preview remains available at `http://localhost:5190`.

## Scrolling investigation — 2026-10-20

### Outcome and scope

No sustained application-caused scroll jank was reproduced in this investigation. The developer clarified that the symptom is primarily **Safari with a mouse wheel**, then reported that **trackpad scrolling is working well** and deprioritized the issue. That is user-reported input-device evidence, not a controlled hardware comparison. A Safari/mouse/driver interaction remains plausible; this audit does not establish its exact cause.

No application optimization or visual change was retained. In particular, there is no custom wheel smoothing, scroll interception, blanket memoization, removed glass/shadow treatment, or changed map interaction. The earlier search-bar slider correction remains intact. This section is independent of the earlier page-load/LCP audit; Lighthouse scores were not used to infer scrolling quality.

### Method and coverage

`frontend/scripts/check_scroll_performance.cjs` records real browser-dispatched wheel events and Page Down input, animation-frame callback intervals, observer callbacks, capsule visibility transitions, React root commits, and browser errors. Chrome additionally records CDP performance counters, timeline traces, and layer-compositing reasons. The React diagnostic hook observes commits and state/prop reference changes; it is not a React Profiler render-duration measurement. It is injected only by the test runner, never shipped in HAVEN.

The completed comparison used installed **Chrome 155.0.8059.85** and **Playwright WebKit 26.5**, 1440×900, light/dark, production preview on port 5190 and Vite development on 5185. There was one complete eight-phase traversal per engine/build/theme combination (64 phases), plus an earlier Chrome production repeat. Performance runs were isolated from other browser regression suites. Production was rebuilt first. Fonts/images were warmed for repeatable renderer comparisons; these are not cold-network/lazy-image stress measurements. External map tiles were replaced with deterministic small image fixtures, so live map-provider latency and full cartographic raster cost are excluded.

Phases covered hero/expanded search → capsule → Grid with slow wheel input; fast down/up wheel input; Page Down; repeated crossings and holds around the capsule threshold; slow left-side Map results scrolling; wheel scrolling over the map; fast Map scrolling; and footer scrolling with at least one five-second editorial rotation. Both handles of the previous price-slider fix are outside this performance task. Scroll checks assert unchanged map camera, connected marker DOM nodes, page movement over the map, and no horizontal overflow.

Actual **Safari 27.0** was also tested directly through native UI controls in a separate tab. A temporary loopback proxy on port 5192 injected the same diagnostics into the unchanged production assets and saved the sample under `/tmp/haven-scroll-native/`. Slow and fast wheel-style native events, Page Down and Down were exercised in the light Grid view. The sample includes interactive/user activity and tool pauses, so it is observational, not a controlled physical-mouse benchmark. A scrollbar-drag attempt was interrupted by user activity and is not claimed as verified. Native dark/Map/trackpad comparisons and the prepared plain-control-page comparison were not completed after the developer deprioritized the issue; automated WebKit covered both themes and Map, but is explicitly not Safari certification.

### Frame scheduling measurements

These are **requestAnimationFrame callback gaps**, not counts of GPU-presented/dropped frames. Browser scheduling, timestamp precision, tracing, native UI automation and host activity affect them. In particular, WebKit/Safari's observed ~10ms cadence must not be interpreted as proof of a higher display frame rate or superiority to Chrome. “>25ms” is a common diagnostic cutoff here, not a browser-specific missed-frame formula.

| Engine / build / theme | RAF intervals | p95 gap | Maximum gap | Gaps >25ms |
| --- | ---: | ---: | ---: | ---: |
| Chrome production light | 928 | 16.8ms | 16.8ms | 0 |
| Chrome production dark | 930 | 16.7ms | 33.3ms | 1 |
| Chrome development light | 930 | 16.8ms | 16.8ms | 0 |
| Chrome development dark | 922 | 16.7ms | 16.8ms | 0 |
| WebKit production light | 1,404 | 11ms | 24ms | 0 |
| WebKit production dark | 1,403 | 11ms | 45ms | 1 |
| WebKit development light | 1,404 | 11ms | 27ms | 1 |
| WebKit development dark | 1,395 | 11ms | 46ms | 3 |
| Actual Safari, interactive light Grid sample | 4,521 | 11ms | 39ms | 2 |

The Safari sample spans 45.3 seconds and contains 475 pixel-mode wheel events and 413 document scroll events. The input source is not identifiable reliably from DOM wheel events, so those events are not classified as a physical mouse versus trackpad. Native screenshots verify resulting positions and capsule presence; they do not capture perceptual motion between frames.

An earlier Chrome production keyboard run had a single 316.6ms RAF gap without a long task. The complete repeat above did not reproduce it. It remains an isolated scheduler/host/graphics observation, not an established application bottleneck. Sparse WebKit footer/fast-scroll gaps likewise did not show sustained degradation. No application's code path is assigned blame solely from those outliers.

### Main thread, CSS and compositing

Across approximately 15.5 seconds of measured phases per Chrome case:

| Chrome case | Scripting | Layout | Style recalculation | Paint trace total | Largest paint event |
| --- | ---: | ---: | ---: | ---: | ---: |
| Production light | 100.1ms | 12.6ms | 66.5ms | 103.7ms | 1.82ms |
| Production dark | 96.6ms | 12.7ms | 66.5ms | 106.9ms | 2.23ms |
| Development light | 422.0ms | 12.1ms | 65.7ms | 109.7ms | 1.19ms |
| Development dark | 440.7ms | 11.4ms | 63.2ms | 109.1ms | 1.54ms |

Chrome recorded **zero ≥50ms long tasks** in these measured phases. Development's additional React/StrictMode/tooling work is visible in scripting totals, but did not create sustained frame gaps in these runs. Counters include diagnostic overhead and are not CPU utilization or mutually exclusive end-to-end latency. Chrome paint recording is main-thread paint work, not GPU presentation time. Comparable WebKit/Safari main-thread and GPU timing was unavailable through these tools; empty unsupported long-task observations must not be read as zero long tasks there.

The layer tree identifies accelerated document scrolling, Leaflet tile transforms, and a localized 484×405px footer backdrop-filter layer plus its mask. Grid wheel scrolling paints more often as hover treatments pass beneath the pointer, but individual paint events remained small. Steady scrolling over the sticky map required no layout or paint events in the measured Chrome map-wheel phase. No evidence justified removing the footer blur, map shadow, card transitions, or adding forced layer promotion. Transitions on the visible capsule are transform/opacity; the histogram height transition is in the closed filter modal and is not active in these page-scroll scenarios.

A small layout-shift entry (~0.00241 per Grid capsule transition) was observed during threshold crossings; it is reported rather than calling these traces “zero CLS.” These deliberate scroll/threshold phases are not a page-load CLS score. There was no sustained layout loop or corresponding long task. The fixed capsule's original search form remained geometrically stable in the dedicated capsule regression suite. A focused follow-up traced it to `results-view-controls`: hiding the inline toggle reduces that right-hand group from about 394px to 210px wide, moving the imagery note horizontally. It is a small, discrete header transition, not an established cause of sustained mouse-wheel jank; it was left unchanged after the issue was deprioritized.

### Observers, React and map behavior

- `useStickySearch` observes stable form/section refs once, uses no scroll polling, and disconnects on cleanup. Four visibility changes occurred for the four intentional boundary crossings in the threshold phase; holding the same side did not flicker or recreate observers. Development's extra disconnected observer is the expected StrictMode setup/cleanup cycle, not an accumulating listener.
- `MapViewport` coalesces actual size changes with one cancellable RAF. Its ResizeObserver recorded zero callbacks during steady measured Map scrolling; marker elements remained connected, and wheel-over-map did not change the camera. The desktop left results scroll in document flow. Below 1200px, the bounded property region intentionally has independent overflow and overscroll containment; it must not be mistaken for document-scroll jank at its boundary.
- Leaflet wheel zoom is disabled. MapControls uses Leaflet's wheel propagation stop only on its toolbar; it does not install a page-wide wheel handler. The React root has delegated listeners; no application page-scroll polling handler was found. Observer, RAF, timer and map zoom/keyboard listeners have cleanup paths. Existing mount/unmount regression checks remain applicable.
- The footer has a local 100ms interval, including while merely offscreen. Root commits were approximately ten per second; this does **not** mean the whole page renders ten times per second. Its local state ownership is explicit in `EditorialSlideshow.tsx`. A separate development diagnostic observed one capsule-transition commit followed by 21 commits whose changed state/prop references belonged only to EditorialSlideshow (`/tmp/haven-scroll-react-check.json`). No measured long-task or sustained jank benefit justified changing its clock. Reduced motion disables automatic rotation.

### Regression checks and preservation

Reran all **145 frontend tests in 19 files**, standalone `npx tsc --noEmit`, and `npm run build`: passed. Production capsule, Map Explorer and footer browser suites cover Grid/Map switching, shared filters, pagination, themes, selection/focus, slideshow controls and reduced motion. All three suites passed twelve width/theme cases each at 375/390/768/1024/1280/1440px plus their supplemental interaction checks. Evidence: `haven-capsule-LqmLJq`, `haven-map-z83eGf`, and `haven-footer-Fy9kUM`. The existing geographic-pin target-size exception remains; no new accessibility finding was introduced. `git diff --check` and syntax checks for the diagnostic script passed.

The starting mixed worktree and `feature/haven-showcase` branch were preserved. A source/asset hash inventory was saved to `/tmp/haven-scroll-baseline.json`; no backend, dependency, dataset, submitted ZIP or application file is intentionally changed by this investigation. Final hashes confirmed every pre-existing file unchanged except this report and CODEBASE_GUIDE.md; the only new repository file is the scroll diagnostic script. The ZIP still hashes to `099f6d3bb3a3731f20e562b45ce5d56c428dc5b10d733455478c3b962a3d4858`. The temporary Safari proxy was stopped and its tab returned to the clean production preview on port 5190. No commit or push was made.

### Reproduction, evidence and remaining manual checks

```sh
HAVEN_SCROLL_RUNS=1 \
NODE_PATH=/Users/joao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
node frontend/scripts/check_scroll_performance.cjs
```

Both local servers and the API must already be running. The default is two repetitions; `HAVEN_SCROLL_ENGINE=chrome` or `webkit` limits the engine. Keep other browser runs and native app interactions separate from measurement. The final script avoids interpreting persistent Fiber flags as component-render counts; the first recorded report's `rendered` name lists are not reliable render counts and are excluded from conclusions. Root commit counts and timing/observer data remain usable.

Complete comparison and 32 Chrome timeline traces: `haven-scroll-IKnION` under the system temporary directory. Earlier Chrome repeat/outlier: `haven-scroll-lLwDaJ` (its subsequent development instrumentation setup failed, not the application). Native sample: `/tmp/haven-scroll-native/1792549262.json`. Temporary traces may be cleaned by the OS; the table and runnable script are the durable record.

If the issue becomes bothersome again, use Safari with the same physical mouse on the production preview and a plain long webpage, then compare trackpad, Page Down and scrollbar dragging. Record browser version, mouse model, any mouse scrolling utility, the exact location, and whether the issue persists in Grid with the pointer away from controls. A Safari Web Inspector Timelines recording during the physical-wheel symptom would help distinguish input-event spacing from rendering stalls. Test a clean browser session only as a comparison; this investigation changed no browser/OS settings. No physical mouse driver, trackpad inertia, extension interaction, GPU presentation, cold live-tile load, or older Safari version has been certified here.
