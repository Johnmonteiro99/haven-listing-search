# HAVEN Image Assets

All 10 user-supplied originals were found in the project root, inspected visually, and moved into `frontend/public/images/`. Names and PNG format were preserved. No resizing, conversion, lossy compression, or duplicate originals were created. The originals total **26,535,277 bytes (25.31 MiB)**. The organization notes below are historical; later phase sections record the implemented derivatives and UI.

These images are presentation assets. The six property illustrations are **not verified photographs of actual MLS listings**. Names such as california-hills describe asset organization; they do not establish an MLS property's location, amenities, architectural style, or view. All listing facts must come from the API's actual fields.

## Inventory

Paths are relative to the project root. MiB uses 1,048,576 bytes. Crop positions are visual-review starting points, not device-tested settings. “Evaluate derivatives” means a recommendation only; originals remain unchanged.

| Actual filename | Relative path | Intended role | Theme | Dimensions | Format | File size | Aspect ratio / crop recommendation | Accessibility / information class | Optimization recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `hero-light.png` | `frontend/public/images/hero/hero-light.png` | Hero backdrop | Light | 1672 × 941 | PNG / RGB, 8-bit | 2,456,910 B (2.34 MiB) | ~16:9; desktop 50% 50%, narrow-screen starting point 75% 50% | Decorative; empty alt if img | Evaluate resized modern-format derivatives |
| `hero-dark.png` | `frontend/public/images/hero/hero-dark.png` | Hero backdrop | Dark | 1672 × 941 | PNG / RGB, 8-bit | 2,327,241 B (2.22 MiB) | ~16:9; use the same crop as hero-light | Decorative; empty alt if img | Evaluate resized modern-format derivatives |
| `footer-light.png` | `frontend/public/images/footer/footer-light.png` | Footer backdrop | Light | 1672 × 941 | PNG / RGB, 8-bit | 2,709,786 B (2.58 MiB) | ~16:9; desktop 50% 50%, narrow-screen starting point 70% 50% | Decorative; empty alt if img | Evaluate resized modern-format derivatives |
| `footer-dark.png` | `frontend/public/images/footer/footer-dark.png` | Footer backdrop | Dark | 1672 × 941 | PNG / RGB, 8-bit | 2,404,049 B (2.29 MiB) | ~16:9; use the same crop as footer-light | Decorative; empty alt if img | Evaluate resized modern-format derivatives |
| `property-beach.png` | `frontend/public/images/properties/property-beach.png` | Illustrative listing presentation | Both (single asset) | 1448 × 1086 | PNG / RGB, 8-bit | 2,745,352 B (2.62 MiB) | 4:3; 50% 50%, wider crop starting point 70% 50% | Decorative; empty alt if img | Evaluate resized modern-format derivatives |
| `property-california-hills.png` | `frontend/public/images/properties/property-california-hills.png` | Illustrative listing presentation | Both (single asset) | 1448 × 1086 | PNG / RGB, 8-bit | 2,853,277 B (2.72 MiB) | 4:3; 50% 50%, wider crop starting point 40% 50% | Decorative; empty alt if img | Evaluate resized modern-format derivatives |
| `property-forest-glass.png` | `frontend/public/images/properties/property-forest-glass.png` | Illustrative listing presentation | Both (single asset) | 1448 × 1086 | PNG / RGB, 8-bit | 3,435,716 B (3.28 MiB) | 4:3; 50% 50%, wider crop starting point 60% 50% | Decorative; empty alt if img | Evaluate resized modern-format derivatives |
| `property-desert.png` | `frontend/public/images/properties/property-desert.png` | Illustrative listing presentation | Both (single asset) | 1448 × 1086 | PNG / RGB, 8-bit | 2,641,374 B (2.52 MiB) | 4:3; 50% 50%, wider crop starting point 65% 50% | Decorative; empty alt if img | Evaluate resized modern-format derivatives |
| `property-alpine.png` | `frontend/public/images/properties/property-alpine.png` | Illustrative listing presentation | Both (single asset) | 1448 × 1086 | PNG / RGB, 8-bit | 2,475,965 B (2.36 MiB) | 4:3; 50% 50%, wider crop starting point 70% 50% | Decorative; empty alt if img | Evaluate resized modern-format derivatives |
| `property-lakeside.png` | `frontend/public/images/properties/property-lakeside.png` | Illustrative listing presentation | Both (single asset) | 1448 × 1086 | PNG / RGB, 8-bit | 2,485,607 B (2.37 MiB) | 4:3; 50% 50%, wider crop starting point 65% 50% | Decorative; empty alt if img | Evaluate resized modern-format derivatives |

## Visual identification

- Hero light/dark: matching viewpoint of a coastal house, pool, and sea; the building occupies the right side.
- Footer light/dark: matching viewpoint of a second house and pool, with a tree on the left and water in the distance.
- Property beach: building on the right with a coastal backdrop.
- Property california-hills: building concentrated left/center with hills behind.
- Property forest-glass: glass-fronted building across the center/right, surrounded by trees.
- Property desert: building across the center/right with arid terrain.
- Property alpine: building on the right with snowy peaks to the left.
- Property lakeside: building on the right with a broad body of water to the left.

These observations identify illustrations and guide cropping only. They must never be copied into listing descriptions or used to infer facts. All expected mappings are accounted for; none required guessing. The geographic label california-hills comes from the supplied filename, not verified location evidence.

## Accessibility standards

Hero/footer images are decorative: prefer CSS backgrounds, or `<img alt="">` where an image element is useful. Do not add redundant screen-reader announcements or descriptive labels to decorative imagery. Keep headings, actions, and meaningful text as real HTML; never place important content only in a bitmap. Use an appropriate overlay or solid text panel and verify contrast over the rendered crop in both themes.

Property images are also decorative when the card already communicates actual listing information. Prefer `alt=""`; do not generate alt text from the illustrated scene as though it depicts the listing. The full card must provide meaningful accessible HTML from real API data (address, price, bedrooms, relevance and other displayed facts). Include clarification such as “Property imagery is illustrative” near results when cards are implemented. This plan does not replace semantic card labels.

If a future image is used to communicate meaningful information, reassess its classification and supply accurate alternative text for that actual use. The current illustrations supply no verified MLS facts.

## Responsive crop and theme plan

Hero/footer originals are 1672 × 941, approximately 16:9; property images are exactly 4:3 at 1448 × 1086. Prefer those ratios initially to minimize cropping. Use a fluid container and `width: 100%`, with `object-fit: cover` for image elements or `background-size: cover` for backgrounds. Set aspect ratio or appropriate responsive reserved height to avoid layout shift. Do not impose a fixed pixel width that overflows narrow screens.

Begin with centered desktop crops; use the inventory's focal positions as candidate adjustments when the layout becomes narrower. Preserve the main building rather than retaining empty sky at its expense. Mobile may need a different ratio or focal point; inspect the real rendered composition before approving it. A short, wide footer crop can remove much of the building vertically, so retain enough height or reconsider the crop rather than forcing an extreme strip.

Hero light/dark depict the same property at different times of day; footer light/dark depict a second property at different times of day. Select the variant by theme while preserving container dimensions, ratio, and focal point within each pair. Their dimensions match, but visual crop stability still needs browser review. Switch source without remounting/resizing the layout. Plan decoding/caching of the alternate source if necessary to avoid flashing; do not automatically prioritize both large variants at startup.

The organization pass implemented no UI. Phase 6.1B now implements a responsive hero and theme switch. Footer imagery, listing cards, and property-image mapping remain unimplemented.

## Performance and optimization plan

Each original is about 2.2–3.3 MiB. Serving all originals at full resolution would transfer about 25.31 MiB before other resources. The UI now loads a selected hero WebP derivative. It does not load PNG originals, footer images, or property images just because they are in public/.

Evaluate smaller responsive derivatives sized for actual card widths (for example 480/800/1200 pixels where justified by display size and device density) and a measured quality comparison for WebP or AVIF with an appropriate fallback. These are proposed output sizes/formats, not generated files. Preserve originals as sources and report any future lossy conversions, sizes, and quality trade-offs. No image-processing library is needed for this organization phase.

Reserve image space via width/height attributes or aspect ratio. Prioritize only the visible main hero variant when implemented (e.g. eager loading and fetch priority for an img); CSS backgrounds may need a deliberate preload. Lazy-load below-the-fold property/footer images and consider async decoding. Render only the current results page's images rather than mounting all listings. Confirm network behavior and layout stability in browsers when UI exists.

## Central manifest and proposed identity mapping

`frontend/src/assets/images.ts` exports `imageAssets`, a readonly TypeScript mapping with light/dark hero and footer URLs and six ordered property URLs. Vite public files are referenced as `/images/...`, omitting `public` from browser URLs. This follows the current root-served Vite setup; a future subpath deployment would require a base-aware URL decision.

The manifest is now imported by `Hero`. `heroResponsive` supplies light/dark WebP candidates; original paths and the canonical property array remain unchanged. No property cards or identity selector are implemented.

**Proposed, not implemented:** select a property illustration from the stable combined `(source, id)` identity, not result index, page number, rank, or randomness. One explainable option:

1. Serialize `[source, id]` with `JSON.stringify`, preserving an unambiguous pair even if IDs contain punctuation.
2. Starting at zero, for each UTF-16 code unit of that string compute `hash = (31 * hash + codeUnit) >>> 0`.
3. Use `hash % imageAssets.properties.length` as the index.

This yields a stable choice across filtering, pagination, sorting, and rerenders as long as the identity, algorithm, and array order stay unchanged. Reusing six images for twelve or more records necessarily allows repeated images; collisions are acceptable because this mapping is decoration, not identity or data integrity. Different feeds are separate identities even when they refer to an apparent duplicate property, though two identities may still select the same illustration. Changing the array order or size would remap identities, so keep the canonical order stable once adopted.

Never persist these presentation choices in backend listing data, change relevance based on imagery, or imply that the mapping verifies a listing's photograph. Introduce the selector and meaningful stability tests when cards are authorized.

## Verification boundary

All originals were visually inspected; signatures, dimensions, file sizes, and extensions were checked. SHA-256 hashes before/after moving prove byte preservation. Inventory/manifest paths, unique source files, frontend tests/build, and unchanged backend content are checked as part of this task. Crop, contrast, theme switching, lazy loading, and responsive derivatives remain plans to verify when their UI is implemented.


Verification completed: all 10 SHA-256 hashes, byte sizes, dimensions, format signatures, and manifest paths match the originals; exactly one source copy remains per image. Backend source file hashes and file inventory are unchanged. `npm test` passed both existing frontend tests, and `npm run build` passed TypeScript checking and Vite production packaging. All 10 public images appear unchanged in generated `frontend/dist/images/`; these ignored build copies are intentional, not duplicate source assets. Git whitespace checks passed. No UI crop/contrast/device validation or backend test rerun was performed for this asset-only task.

## Phase 6.1B optimized hero derivatives

The approved reference is `listing-project-ui.png` at the project root; it is a visual guide, not an MLS dataset or public image. Original PNGs remain byte-for-byte unchanged. `frontend/scripts/optimize_hero.py` uses Pillow 12.3.0, Lanczos resizing, and **lossy WebP quality 82 / method 6**. Both full-size derivatives were visually reviewed against the originals. Some fine-detail compression is expected; these files are presentation derivatives, not archival replacements.

| Relative path | Dimensions | Bytes | Reduction from original PNG |
| --- | --- | --- | --- |
| frontend/public/images/hero/hero-light-640.webp | 640 × 360 | 37,514 | 98.47% |
| frontend/public/images/hero/hero-light-1024.webp | 1024 × 576 | 82,778 | 96.63% |
| frontend/public/images/hero/hero-light-1672.webp | 1672 × 941 | 172,010 | 93.00% |
| frontend/public/images/hero/hero-dark-640.webp | 640 × 360 | 38,666 | 98.34% |
| frontend/public/images/hero/hero-dark-1024.webp | 1024 × 576 | 85,598 | 96.32% |
| frontend/public/images/hero/hero-dark-1672.webp | 1672 × 941 | 180,024 | 92.26% |

Original light PNG: 2,456,910 bytes. Original dark PNG: 2,327,241 bytes. The six derivatives total 596,590 bytes; a normal page loads only the selected theme/candidate, not all six. Browsers choose a candidate using `srcSet`, `sizes`, viewport size, device density, and cache. In a fresh narrow high-density check, the 1024px candidate loaded; larger layouts used 1672px. Browsers may retain a cached larger candidate when resizing downward.

To reproduce, from the project root:

```sh
python3 -m venv frontend/.venv
frontend/.venv/bin/python -m pip install Pillow==12.3.0
frontend/.venv/bin/python frontend/scripts/optimize_hero.py
```

Only the tool environment needs Pillow. The script deliberately rebuilds the six named derivatives; it never writes the PNG originals. Inspect quality and report new sizes if changing settings. Hero images have empty alt, high fetch priority, eager loading, async decoding, and reserved dimensions. Mobile uses a 75% 50% focal point in a 360px frame; desktop uses center positioning. Both themes retain matching geometry.

The final Chrome width/theme checks reported loaded images and no overflow at all requested widths. Automated accessibility checks found zero final violations after removing theme color interpolation. Property/footer optimization and visual UI remain future work. Previous organization verification above describes that earlier phase, not a claim that theme UI is still absent.

## Phase 6.2B property derivatives and stable mapping

ListingCard now uses all six property illustrations through `imageAssets.propertyResponsive` and `getListingImage(source, id)`. The proposed mapping above is now implemented: JSON-encoded identity pair, UTF-16 rolling hash multiplied by 31, unsigned 32-bit result, modulo the canonical six-image array. Rank/index/page/theme never enter the calculation. Collisions are expected and do not change MLS identity or deduplicate records. Original manifest paths and PNGs remain intact. Phase 6.3A now uses footer derivatives in EditorialSection.

`frontend/scripts/optimize_properties.py` uses the existing frontend-local Pillow tooling environment, Lanczos resizing, and lossy WebP quality 82 / method 6. Each original is 1448×1086; derivatives retain 4:3 at 480×360 and 800×600. All six 800px derivatives were visually inspected. Compression reduces fine detail; these are delivery assets, not replacements for the originals. No image-processing dependency ships in the browser.

| Illustration | 480px bytes | 800px bytes |
| --- | ---: | ---: |
| property-beach | 35,814 | 91,548 |
| property-california-hills | 41,136 | 104,834 |
| property-forest-glass | 58,952 | 150,218 |
| property-desert | 31,140 | 79,118 |
| property-alpine | 34,666 | 79,362 |
| property-lakeside | 31,756 | 75,566 |

Paths follow `frontend/public/images/properties/<illustration>-480.webp` and `-800.webp`. All twelve total **814,110 bytes**, compared with **16,637,291 bytes** for the six originals. A browser loads its selected candidate and can reuse cached illustrations across records. The 800px cap is a deliberate transfer/quality trade-off: very dense displays at wider card sizes may not receive a full device-pixel-resolution image.

Reproduce from the project root using the existing environment:

```sh
frontend/.venv/bin/python frontend/scripts/optimize_properties.py
```

If needed, create the environment and install Pillow with the commands in the hero section. The script only writes the twelve named WebP derivatives. Card img elements use empty alt, lazy loading, async decoding, an 800×600 size hint, and a 4:3 object-fit-cover frame. CSS reserves space before loading; srcSet/sizes lets the browser choose a candidate. The current matching aspect ratio retains the scene; focal positions are centralized in the responsive manifest. A visible notice says property imagery is illustrative, and no scene details are copied into listing facts.

Verification includes derivative dimensions/bytes, visible browser loading and crops, stable mapping tests, and unchanged original/backend hashes against the earlier snapshot. All requested viewport/theme checks passed without horizontal overflow. Earlier sections explicitly marked proposed or historical describe the earlier asset-organization stages; this section records the implemented card behavior.


## Phase 6.3A footer integration

`imageAssets.footerResponsive` now supplies light/dark 640px and 1024px candidates to EditorialSection. Only the resolved theme is rendered; the alternate is not prioritized or preloaded. Images use empty alt text, lazy loading, async decoding, and width/height hints. Layout reserves at least 360px desktop, 260px tablet, or 220px mobile before loading. The 1024px cap balances transfer and detail; high-density wide tablet strips may not receive full device-pixel resolution.

| Derivative under frontend/public/images/footer/ | Dimensions | Bytes |
| --- | --- | ---: |
| footer-light-640.webp | 640 × 360 | 45,466 |
| footer-light-1024.webp | 1024 × 576 | 103,328 |
| footer-dark-640.webp | 640 × 360 | 41,296 |
| footer-dark-1024.webp | 1024 × 576 | 92,344 |

All four total **282,434 bytes**, versus **5,113,835 bytes** for the two original PNGs. `frontend/.venv/bin/python frontend/scripts/optimize_footer.py` reproduces them using the existing Pillow 12.3.0 tooling environment, Lanczos resizing, lossy WebP quality 82 / method 6. It writes only the four named derivatives. Both 1024px outputs were visually compared with the originals; compression sacrifices some fine detail, not archival source data.

Footer cropping favors architecture at 75% 50% on desktop/mobile and 50% 60% on tablet. A CSS pseudo-element blends from the solid editorial surface to transparent at 45% horizontally (desktop) or vertically (stacked). The gradient is not baked into assets. Critical text occupies separate solid columns, so image content does not determine its contrast.

Hero derivatives are reused unchanged. The new CSS overlay fades earlier to reveal more architecture; desktop uses a left-to-right blend and mobile a top-to-bottom blend. Theme switching preserves the same element/frame, with one eagerly loaded, high-priority hero. Footer imagery remains decorative and does not assert property facts.

## Advanced filter panel day/night imagery

The newly supplied `filters-panel-day.png` and `filters-panel-night.png` were visually inspected as matching 941×1672 PNG views of the same coastal architecture, pool, terrace and planting in daylight/night light. They are decorative illustrations, not verified listing photographs. Only these two root files were moved, with original bytes preserved:

| File under frontend/public/images/filters/ | Dimensions | Bytes | Role |
| --- | --- | --- | --- |
| haven-filters-panel-day.png | 941×1672 | 2,213,479 | Preserved daytime original |
| haven-filters-panel-night.png | 941×1672 | 2,062,659 | Preserved nighttime original |
| haven-filters-panel-day-480.webp | 480×853 | 54,472 | Narrow/light derivative |
| haven-filters-panel-day-941.webp | 941×1672 | 146,494 | Full-size/light derivative |
| haven-filters-panel-night-480.webp | 480×853 | 55,454 | Narrow/dark derivative |
| haven-filters-panel-night-941.webp | 941×1672 | 146,036 | Full-size/dark derivative |

Original SHA-256: daytime `91f8cabad2e70a835cbd27d64f9b3c16511677a23ec2bdc24258c5efd5e727e3`; nighttime `f48b4796a33b881b236d0f57e734bc3fabb4b087a2305239b3b3739963717489`. The four WebPs total 402,456 bytes, about 90.6% smaller than the combined PNG sources. A normal opening loads one theme/candidate, not all four. `frontend/scripts/optimize_filters.py` reproduces them using the existing ignored Pillow tooling environment, Lanczos resizing, lossy WebP quality 82/method 6, and no upscaling. The originals are archival sources, not normal UI transfers.

`imageAssets.filtersResponsive` is the single manifest authority for light/day and dark/night. `AdvancedFilterDialog` now uses these 480/941px sources instead of the hero scene; the rest of the page's hero/footer/property mapping is unchanged. Desktop uses a centered tall crop; the compact mobile image header uses 65%/54% object positioning. Both keep empty alt and the existing aria-hidden editorial image area. The existing dark gradients protect the unchanged white text overlay. Both originals and the served derivatives/crops were visually reviewed; the portrait framing preserves architecture on desktop without manufacturing listing facts.
