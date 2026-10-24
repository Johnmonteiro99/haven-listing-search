# HAVEN confirmed fix log

Brief explanations of confirmed fixes and important UI interaction refinements. Follow the five-section reporting rule in [AGENTS.md](../AGENTS.md); keep detailed architecture in [CODEBASE_GUIDE.md](CODEBASE_GUIDE.md).

The initial entries below were backfilled on 2026-10-20 from inspected source, the recorded changes, and existing verification records. Their test results are historical, not new test runs performed during this documentation task. These changes are present in the working tree; this log does not imply they have been committed or deployed.

## 2026-10-20 — Safari quick-search price slider gesture

### 1. PROBLEM

Setting a price through the search bar's popover could close the control during a drag in Safari. The user initially described unwanted movement on hover and clarified that the issue occurred in the search bar, rather than the inline advanced filters.

### 2. ROOT CAUSE

Pressing a native range thumb in Safari could move focus to a page ancestor. `PriceRange` treated that blur as leaving the popover and hid it before the native drag received its release; this premature closure was reproduced, while the reported hover-only symptom was not independently reproduced through native Safari automation.

### 3. SOLUTION

`PriceRange` records the pressed range input and suppresses blur dismissal for that gesture. Pointer release/cancel clears the reference and focuses the handle; window departure and effect cleanup also clear it, preserving native slider behavior and existing numeric validation.

### 4. VERIFICATION

The [slider verification record](CODEBASE_GUIDE.md#advanced-filter-refinement-dual-price-range-and-real-distribution) reports 145 frontend tests, TypeScript, build and whitespace checks passing, plus Chrome/WebKit hover, drag, release and keyboard checks. Actual Safari 27.0 reproduced the premature closure and verified both handles, keyboard adjustment and Escape/focus restoration after the fix; exhaustive hover-only assertions were automated Chrome/WebKit checks, not native Safari verification.

### 5. INTERVIEW TAKEAWAY

“I traced the slider problem to the popover's focus handling. I kept the native control and made dismissal aware of an active gesture, then tested release cleanup as well as keyboard behavior.”

Relevant files: [PriceRange.tsx](../frontend/src/components/PriceRange.tsx), [FilterControls.test.tsx](../frontend/src/components/FilterControls.test.tsx), [check_slider_pointer.cjs](../frontend/scripts/check_slider_pointer.cjs).

## 2026-10-20 — Solid circular price-slider knobs

### 1. PROBLEM

The price handles looked hollow or tire-like rather than like clean circular knobs. When their values coincided, the visual handles could obscure each other.

### 2. ROOT CAUSE

The previous thumb CSS used radial-gradient artwork, including a hollow minimum-handle ring, within larger native hit areas. The small vertical separation at equal values still allowed the visible circles to overlap; this was a styling issue, not a confirmed browser-engine defect.

### 3. SOLUTION

Shared-track pseudo-elements now draw solid 22px circles with a thin border and soft outer shadow, while explicitly reset transparent native thumbs retain 44px drag targets. Theme tokens, hover/focus feedback, reduced-motion rules and greater separation at equal values provide the requested appearance without changing price logic.

### 4. VERIFICATION

The [circular-knob record](CODEBASE_GUIDE.md#advanced-filter-refinement-dual-price-range-and-real-distribution) reports 145 frontend tests, TypeScript, build and whitespace checks passing. Chrome/WebKit checks and screenshots covered both themes, circular geometry, coincident handles, focus, hover, reduced motion and native interactions; actual Safari was not retested for this styling pass, and Firefox automation failed to start successfully.

### 5. INTERVIEW TAKEAWAY

“I separated the visual knob from its interaction target. That let me make the handle minimal and circular while keeping a comfortable native drag target and clear keyboard focus.”

Relevant files: [styles.css](../frontend/src/styles.css) (`.dual-price-track` and native thumb rules), [tokens.css](../frontend/src/theme/tokens.css) (`--slider-knob-*`), [check_slider_pointer.cjs](../frontend/scripts/check_slider_pointer.cjs).

## 2026-10-20 — Calmer footer slideshow controls

### 1. PROBLEM

Three segmented indicators and a Play/Pause button made the editorial footer feel too busy. The requested refinement was one continuous progress bar with unobtrusive access to all three messages.

### 2. ROOT CAUSE

`EditorialSlideshow` explicitly rendered three segment buttons and separate playback controls. Its progress clock updated local React state every 100ms and continued off-screen; that unnecessary work was confirmed in source, but was not established as a cause of scrolling jank.

### 3. SOLUTION

A five-second CSS fill animation now advances the message on completion and resets through a new keyed fill element, replacing the interval and playback state. One Next button preserves manual access; hover, focus, document visibility and IntersectionObserver pause progress, while reduced motion disables autoplay and leaves stable, manually navigable content.

### 4. VERIFICATION

The [continuous-progress verification record](DESIGN_SYSTEM.md#compact-editorial-footer-slideshow) reports 146 frontend tests, TypeScript, build and whitespace checks passing. Twelve Chrome width/theme cases passed with zero scoped Axe findings, alongside timing/reset, pause/resume, off-screen, keyboard, reduced-motion and touch-emulation checks; native Safari, Firefox, physical devices and human screen-reader use were not tested for this refinement.

### 5. INTERVIEW TAKEAWAY

“I made the progress animation the single clock for the slideshow, so React only changes the message when the fill finishes. I also paused work when readers interact or the footer is off-screen, and kept a simple manual control for reduced-motion users.”

Relevant files: [EditorialSlideshow.tsx](../frontend/src/components/EditorialSlideshow.tsx), [EditorialSlideshow.test.tsx](../frontend/src/components/EditorialSlideshow.test.tsx), [App.test.tsx](../frontend/src/App.test.tsx), [styles.css](../frontend/src/styles.css), [tokens.css](../frontend/src/theme/tokens.css), [check_footer_blend.cjs](../frontend/scripts/check_footer_blend.cjs).

## Boundaries of this history

The [scrolling investigation](PERFORMANCE_AUDIT.md#scrolling-investigation--2026-10-20) established no sustained application-caused jank and retained no application fix, so it is not listed as a confirmed fix. Rejecting `750000>` as a price was correct validation, not a parsing defect.


## 2026-10-21 — Phone Map workspace and reachable record choices

### 1. PROBLEM

Phone Map felt like a desktop results page compressed into a small screen. During the redesign, short-screen checks also found that map controls could overlap the selected card and anchored MLS-record choices could open underneath the floating header.

### 2. ROOT CAUSE

The existing narrow layout stacked a bounded map and full results region. New floating overlays reduced the usable space, while Leaflet's non-panning anchored popup still positioned choices above each marker; near-top markers therefore placed buttons behind the header.

### 3. SOLUTION

Below 768px, dedicated header/deck components reuse the existing search and source/ID selection owners over a viewport map. Short phones use a scrolling card and horizontal controls; shared-coordinate choices are portalled above the overlays, preserving Leaflet's close/focus lifecycle and the map camera.

### 4. VERIFICATION

153 frontend tests, standalone TypeScript, production build and whitespace checks passed. Chrome checked four phone sizes and four tablet/desktop widths in both themes, including every shared-record chooser, keyboard/touch-emulated flows, focus, filters, paging, camera/request preservation and overflow; phone Axe checks were clear, while larger maps retained the documented dense-pin target-size findings. Tiles were fixtures; physical devices, native Safari/Firefox, virtual keyboards and human screen readers were not tested.

### 5. INTERVIEW TAKEAWAY

“I kept search and selection state in their original owners and changed the mobile presentation around them. Small-screen testing caught an overlay collision, so I used a React portal to keep record choices reachable without moving the map or adding another selection system.”

Relevant files: [useMobileMap.ts](../frontend/src/search/useMobileMap.ts), [MobileMapHeader.tsx](../frontend/src/map/MobileMapHeader.tsx), [MobileMapDeck.tsx](../frontend/src/map/MobileMapDeck.tsx), [mobileMap.css](../frontend/src/map/mobileMap.css), [MapExplorer.tsx](../frontend/src/map/MapExplorer.tsx), [ListingMap.tsx](../frontend/src/map/ListingMap.tsx), [MapViewport.tsx](../frontend/src/map/MapViewport.tsx), [SearchPanel.tsx](../frontend/src/components/SearchPanel.tsx), [SearchResults.tsx](../frontend/src/components/SearchResults.tsx), [MobileMap.test.tsx](../frontend/src/map/MobileMap.test.tsx), [check_mobile_map.cjs](../frontend/scripts/check_mobile_map.cjs). Detailed architecture: [Phone map workspace](CODEBASE_GUIDE.md#phone-map-workspace).
