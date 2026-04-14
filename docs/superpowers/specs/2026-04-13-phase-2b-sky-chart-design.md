# Phase 2b — Canvas 2D Sky Chart — Design

**Status:** Draft
**Date:** 2026-04-13
**Author:** Andrew Robalino Garcia + Claude (brainstormed)
**Predecessor:** `2026-04-08-phase-2a-frontend-foundation-design.md` (Phase 2a — Frontend Foundation)

---

## 1. Scope & Goals

Build an immersive 2D sky chart that replaces the `HeroRegion` placeholder from Phase 2a. The chart is the centerpiece of SkyVault — the first visible proof that the app is powered by real astronomical data.

### Design direction (locked)

- **Hybrid aesthetic** — immersive first (dark, glow, cinematic), scientific second (accurate positions, real magnitudes, source attribution).
- **Progressive disclosure** — on load the chart is clean and wordless. Hover reveals a subtle highlight ring. Click reveals a tooltip with real data.
- **Rectangular full-bleed stereographic projection** — zenith at center, sky fills the entire rectangular hero region. No visible horizon ring, no disc clipping. Cardinal labels (N/S/E/W) sit at the rectangle edges for orientation.
- **Wide projection scale** — default reference altitude 20°: the zenith-to-20°-altitude region fills the rectangle's shorter half. Stars below that altitude still render if their projected position falls inside the rectangle, but the horizon is mostly off-screen on the sides.
- **Viewport-capped sizing** — the chart height clamps so the chart plus the top of the controls strip fits above-the-fold on common laptop displays without scrolling.

### In scope (Phase 2b)

- `SkyChart` component replacing the HeroRegion placeholder.
- Stereographic projection utility (`utils/projection.js`) — AltAz → canvas (x, y).
- Canvas 2D rendering: background gradient (via CSS, not canvas), stars with magnitude-scaled glow and BP-RP-tinted color, planets as distinct amber-tinted markers, cardinal labels as HTML overlays.
- Viewport-capped layout: `height: min(56.25vw, calc(100vh - 14rem))` with a `min-h-[260px]` floor.
- Hover state: subtle ring over nearest object within cursor radius, via HTML overlay (no canvas redraw).
- Click state: selected object + HTML tooltip overlay. Tooltip shows name (planets) or Gaia source_id (stars), magnitude, color index, distance, altitude, azimuth, and a source badge.
- Debounced redraw (150ms) on observer change, container resize, and DPR change.
- State overlays: idle (pre-submit), loading (during query), error (query failure), empty (unlikely — zero stars).
- Unit tests for projection math and hit detection.
- Component tests for render, hover, click-select, tooltip content, dismissal behavior.

### Out of scope (deferred to later phases)

- Constellation stick figures → Phase 3 (IAU data).
- Star names / SIMBAD enrichment badges → Phase 3.
- Exoplanet host indicators → Phase 3.
- Zoom / pan / rotate view → Phase 4 (Explore Mode handles this via Three.js).
- Comets, asteroids, small bodies → Phase 4 (JPL Horizons).
- Deep sky objects (galaxies, nebulae, black holes) → v2 post-launch.
- Milky Way band texture on the canvas (hinted at in the visual mockup but not shipping in 2b — revisit as polish).
- Full keyboard navigation of canvas objects → Phase 5 polish. Canvas carries an ARIA label; info panels below are already keyboard-navigable.

### Architecture supports layered object kinds

The projection, hit-test, tooltip, and drawing pipelines dispatch on an object `kind` field (`"star"`, `"planet"`, and later `"constellation_line"`, `"galaxy"`, `"comet"`, `"named_star"`). Phase 3, Phase 4, and v2 additions plug in new kinds without refactoring existing code.

### Non-negotiables (from repo CLAUDE.md)

- No faked data. The chart renders `useSky` + `usePlanets` output verbatim. No demo stars, no placeholder astronomy, no hardcoded positions.
- Every tooltip displays a source badge (`Gaia DR3` for stars, `JPL DE421 via Astropy` for planets). Data attribution is a product requirement, not a nice-to-have.
- Dark immersive aesthetic preserved. No light-mode styles, no heavy UI chrome over the sky.
- No new dependencies. Canvas 2D is native browser API.

---

## 2. Architecture

### Component tree

```
HeroRegion (existing)
└── SkyChart                    (new — replaces placeholder)
    ├── SkyCanvas               (new — <canvas>, imperative drawing)
    ├── CardinalLabels          (new — 4 absolute-positioned divs)
    ├── SelectionRing           (new — absolute div over selected/hovered object)
    ├── SkyTooltip              (new — floating card with object data)
    └── SkyStatusOverlay        (new — idle / loading / error states)
```

### Why this split

- **`SkyCanvas` is the only component that touches imperative canvas APIs.** It's a pure "props in → pixels out" component with no hit testing, no selection, and no React children.
- **Cardinal labels, selection ring, and tooltip are HTML.** They get React's render/unmount semantics, CSS animations, and keyboard/ARIA support for free.
- **`SkyStatusOverlay` isolates the three non-data states** (idle / loading / error) from the canvas component so we don't conditionally mount and unmount the canvas.

### State & data flow

```
observerStore.selected + observerStore.datetimeUtc
        ↓
useSky()        →  { data: SkyResponse, isLoading, error }
usePlanets()    →  { data: PlanetsResponse, isLoading, error }
        ↓
SkyChart:
  - useCanvasSize(containerRef)  → { width, height, dpr }
  - useMemo project()            → { stars: ProjectedStar[], planets: ProjectedPlanet[] }
  - local useState               → hoveredId, selectedId
        ↓
  SkyCanvas            (projected arrays, w, h, dpr)
  CardinalLabels       (static)
  SelectionRing        (projected object + hoveredId + selectedId)
  SkyTooltip           (selected projected object, or null)
  SkyStatusOverlay     (query states)
```

### New files

```
client/src/components/hero/
├── SkyChart.jsx                  container, owns selection state
├── SkyCanvas.jsx                 <canvas>, imperative drawing inside useEffect
├── CardinalLabels.jsx            N/S/E/W absolute-positioned labels
├── SelectionRing.jsx             positioned HTML ring (hover + selected)
├── SkyTooltip.jsx                floating card with object data + source badge
└── SkyStatusOverlay.jsx          idle / loading / error overlays

client/src/utils/
├── projection.js                 stereographic math (AltAz + rect → x, y, scale)
├── hitTest.js                    findNearestWithinRadius(projected, mx, my, r)
└── drawing.js                    pure canvas fns: drawStar, drawPlanet
                                  (drawBackground deferred — CSS gradient handles it)

client/src/hooks/
└── useCanvasSize.js              ResizeObserver + DPR tracking, returns {w,h,dpr}
```

### Key architectural decisions

1. **`SkyCanvas` is imperative and isolated.** Takes projected arrays + dimensions as props. Draws via `useEffect`. No state inside, no hit testing, no React children.
2. **Projection runs once per data/size change**, memoized via `useMemo`. Output is a typed array shared by canvas, hit test, and selection ring.
3. **Hit testing lives in `SkyChart`**, not `SkyCanvas`. Mouse events fire on the container div; `SkyChart` maps coordinates to an object (or null) via `hitTest.js`.
4. **Selection and hover highlights are HTML**, not canvas redraws. `SelectionRing` is an absolute-positioned `<div>` driven by state. Canvas never redraws on hover.
5. **Resize handled by a single `useCanvasSize` hook** using `ResizeObserver` and DPR tracking. Feeds `SkyCanvas` which re-projects and redraws debounced 150ms.

---

## 3. Rendering Pipeline

### Projection math (`utils/projection.js`)

Stereographic projection from zenith:

```
zenithAngle = 90° - alt                    // degrees: 0 at zenith, 90° at horizon
r = tan(zenithAngle / 2)                   // unit-less, monotone increasing
x_norm = r * sin(az_radians)               // east positive (canvas x increases right)
y_norm = -r * cos(az_radians)              // north up (canvas y increases down, so negate)

// Scale so that the reference altitude maps to the shorter half of the rectangle
halfShort = min(width, height) / 2
refZenithAngle = 90° - REFERENCE_ALT       // default REFERENCE_ALT = 20°
scale = halfShort / tan(refZenithAngle / 2)

canvas_x = width/2 + x_norm * scale
canvas_y = height/2 + y_norm * scale
```

`REFERENCE_ALT` lives as a module constant in `projection.js`. Changing it changes how much sky fits in the rectangle.

The API's `include_below_horizon=false` default guarantees `alt >= 0` for every returned star, so we don't need to clip by altitude during projection. We do filter projected positions that fall outside the rectangle before draw (pure optimization).

### Drawing pipeline (per render, inside `SkyCanvas`'s `useEffect`)

1. **Set transform** — `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` once per draw for DPR scaling.
2. **Clear** — `ctx.clearRect(0, 0, cssWidth, cssHeight)`. Canvas is transparent; container provides the radial background gradient via CSS.
3. **Draw stars** — iterate `projectedStars`:
   - Skip stars whose projected (x, y) is outside the rectangle (cheap bounds check).
   - Compute `{core, halo}` from magnitude via `magnitudeToGlow(mag)`.
   - Compute color via `bvToHex(bp_rp)` (reuses existing util).
   - If `halo > 0` (bright stars): draw radial gradient from white core → tinted mid → transparent edge.
   - Else (dim stars, `mag > 4`): draw a single filled pixel with color. No gradient overhead.
4. **Draw planets** — iterate `projectedPlanets`:
   - Fixed per-body marker sizes (diameter, px): `Sun 16, Moon 16, Venus 12, Jupiter 12, Mars 11, Mercury 10, Saturn 10, Uranus 10, Neptune 10`.
   - Amber-tinted radial gradient + 1px bordered ring to differentiate from stars.
   - Moon gets a custom path: filled disc with a shadow arc representing the un-illuminated fraction (uses `illumination` from Phase 2a's API response).
   - Sun is rendered as a warm yellow-white disc instead of amber (distinct from nighttime planets).

Cardinal labels are HTML overlays, not canvas.

### Star size + glow calibration

Implemented as `magnitudeToGlow(mag) → {core, halo}` in `drawing.js`:

| Apparent magnitude | Core (px) | Halo (px) | Notes |
|---|---|---|---|
| ≤ 0 | 3.0 | 18 | Sirius, Vega — bold halo |
| 0 – 2 | 2.5 | 12 | Most named stars |
| 2 – 4 | 2.0 | 6 | Familiar naked-eye |
| 4 – 6 | 1.5 | 3 | Faint but visible |
| > 6 | 1.0 | 0 | Pixel dot, no gradient |

Brighter stars (lower magnitude) are bigger. All tunable in one place. `core` and `halo` linearly interpolate within each range (e.g., mag 1.0 is halfway between the mag 0 and mag 2 values). Stars with `mag > 6` clamp to the dim tier; stars with `mag <= 0` clamp to the brightest tier.

### Color handling

- Stars with `bp_rp != null` → `bvToHex(bp_rp)` for core + halo tint.
- Stars with `bp_rp == null` → fall back to `#ffffff` (matches existing `StarsPanel` behavior).

### Performance budget

- Expected visible stars at mag_limit 6.5: ~2000–3500 at typical latitudes and times.
- Full-gradient stars (mag ≤ 4): roughly 200 per frame.
- Pixel-dot stars (mag > 4): roughly 1800–3300 per frame.
- Estimated full-redraw cost: ~30ms on a mid-range laptop.
- Redraws fire only on observer change / resize / DPR change — not on hover.
- If profiling shows strain: promote to a sprite cache (Approach C, held in reserve).

### DPR handling (via `useCanvasSize`)

- `ResizeObserver` watches the container; gives `{ cssWidth, cssHeight }`.
- `window.devicePixelRatio` tracked via `matchMedia('(resolution: Xdppx)')` listener.
- Canvas internal buffer: `cssWidth * dpr × cssHeight * dpr`.
- CSS size: `cssWidth × cssHeight`.
- All drawing uses CSS coordinates; `setTransform(dpr, 0, 0, dpr, 0, 0)` handles the mapping.

### Redraw triggers

- Observer store changes (new data → re-project → redraw).
- Canvas CSS size changes (ResizeObserver callback, debounced 150ms).
- DPR changes (user drags window to a different-DPR monitor).

Hover and selection never trigger a canvas redraw.

---

## 4. Interaction Model

### Local state (inside `SkyChart`)

```
hoveredId:  string | null    // "star:{source_id}" | "planet:{name}" | null
selectedId: string | null    // same format, persists until clicked elsewhere
```

IDs are namespaced by object kind so star `source_id` values can't collide with planet names.

### Hit testing (`utils/hitTest.js`)

```
findNearestWithinRadius(projected, mouseX, mouseY, cursorRadius = 14)
  → { id, x, y, kind, ...objectData } | null
```

- Linear scan over the combined stars + planets array.
- For each object, compare `(dx)² + (dy)²` to `cursorRadius²`.
- Returns the nearest match within the radius, or null.
- Stars use `cursorRadius = 14px`; planets use `cursorRadius = 22px` (they're sparser, larger markers, easier targeting). When both a star and a planet are within their respective radii, the planet wins if the cursor is within the planet's radius.
- ~2000 distance checks per mousemove is negligible on modern CPUs.

### Hover behavior

- `mousemove` on container → run hit test → set `hoveredId`.
- When `hoveredId != null`:
  - Container applies `cursor: pointer`.
  - `SelectionRing` renders over the hovered object at ~40% opacity.
  - No tooltip appears yet.
- `mouseleave` → clear `hoveredId`.

### Click behavior

- `click` on container → run hit test:
  - Hit → set `selectedId = id`; `SkyTooltip` appears anchored to the object.
  - No hit → clear `selectedId`; tooltip dismisses.
- `SelectionRing` on selected object renders at ~80% opacity with a slightly different stroke.

### Tooltip content

**Star:**
```
Star
Gaia DR3 · {source_id}
───────────────
Magnitude       {G mag, 2 decimals}
Color index     {bp_rp, 2 decimals, or "—" if null}
Distance        {distance_ly, 1 decimal} ly  (or "—" if null)
Altitude        {alt, 1 decimal}°
Azimuth         {az, 1 decimal}°
───────────────
Source: Gaia DR3
```

**Planet (non-Moon):**
```
{name}
───────────────
Distance        {distance_au, 2 decimals} AU
Altitude        {alt, 1 decimal}°
Azimuth         {az, 1 decimal}°
───────────────
Source: JPL DE421 via Astropy
```

**Moon** adds `Illumination {illumination * 100}%` and `Phase {phase_name}` rows when those fields are present in the API response.

### Tooltip positioning

- Anchored to the object's canvas (x, y), offset up+right by 12px.
- Flips to down+left when it would overflow the container edges.
- Width: 240px on desktop, clamped to `min(240px, 100% - 32px)` on mobile.
- Uses `translate3d` for smooth positioning.
- Fade-in + slight scale-up animation (120ms).

### Dismissal

- Click empty sky → clear selection.
- Click a different object → switch selection.
- New observer query arrives → clear both `selectedId` and `hoveredId` (positions have shifted).
- Escape keypress → clear selection (light a11y win).

### Touch / mobile

- `pointer: coarse` detected via CSS — hover state disabled on touch devices.
- Tap = click equivalent.
- Tap empty area dismisses tooltip.
- No tap-and-hold behavior.

### Accessibility

- Canvas element carries `role="img"` and `aria-label="Night sky for {place} on {date}"`.
- Tooltip content is a semantic `<div>` with a `role="dialog"` and focus trap on desktop.
- Full keyboard nav of canvas objects deferred to Phase 5. Info panels below the chart remain keyboard-navigable.

---

## 5. Layout & Sizing

### Hero container

```jsx
<section className="
  relative w-full overflow-hidden border border-rule bg-bg/80
  h-[min(56.25vw,calc(100vh-14rem))]
  min-h-[260px]
">
  <SkyChart />
</section>
```

- **Width:** 100% of FrameContainer inner (max 1200px given the existing `max-w-[1280px]` + `px-10` padding).
- **Height:** `min(56.25vw, calc(100vh - 14rem))`
  - `56.25vw` preserves 16:9 aspect when viewport has room.
  - `calc(100vh - 14rem)` ensures the chart + top of controls fit above-the-fold on common laptops.
- **Floor:** `min-h-[260px]` prevents the chart from becoming a letterbox slit on tiny viewports.

### Resulting dimensions

| Viewport | Chart (W × H) | Aspect |
|---|---|---|
| 1920 × 1080 desktop | 1200 × 675 | 16:9 |
| 1440 × 900 MacBook Air | 1200 × ~620 | ~2.3:1 |
| 1366 × 768 laptop | 1200 × ~544 | ~2.2:1 |
| 390 × 844 phone (portrait) | 342 × ~192 | 16:9 (from `56.25vw`) |

### Above-the-fold target

On 1366 × 768 (standard laptop):
```
Browser chrome + tabs  ≈ 100px
FrameContainer padding   56px
Header                 ≈  80px
space-y-10 gap            40px
Chart height (clamped)  ~544px
──────────────────────────────
Used                    820px
Viewport                768px  — slight overflow, controls start just below fold
```

The `14rem` (224px) subtraction is tuned so a hint of the controls strip peeks below the chart on most laptops, signaling "interact here."

### Inside the rectangle

- Cardinal labels: `absolute` + 12px inset from each edge.
- Tooltip: positioned at object coords, edge-flip logic keeps it inside the container.
- Canvas: fills 100% of container, `position: absolute; inset: 0`.
- Selection ring: `absolute`, positioned at object (x, y), translate-based.

### Explicitly not in 2b

- No aspect-ratio toggle for user.
- No fullscreen button (Phase 4 Explore Mode owns fullscreen).
- No zoom / pan controls (deferred).

---

## 6. Data Integration & States

### Flow summary

```
observerStore.selected, datetimeUtc
         ↓
SkyChart
    ├─ useSky(selected, datetimeUtc)      → skyQuery
    ├─ usePlanets(selected, datetimeUtc)  → planetsQuery
    ├─ useCanvasSize(containerRef)        → { width, height, dpr }
    └─ useMemo project({...stars, ...planets}, width, height) → projected
```

### State matrix

| `selected` | `skyQuery` / `planetsQuery` | Display |
|---|---|---|
| null | — | **Idle overlay** — dark gradient + "Pick a date and location" eyebrow. No decorative fake stars. |
| not null | both `isLoading` | **Loading overlay** — dimmed canvas + "Computing sky for {place}". Pulse animation; no spinner wheel. |
| not null | either `error` | **Error overlay** — uses existing `ErrorCard`. Retry button calls `query.refetch()`. |
| not null | both `success`, 0 stars | **Empty state** — "No stars above magnitude X" hint. (Extremely unlikely at default mag_limit 6.5.) |
| not null | both `success` | **Rendered chart.** |

All overlays live in `SkyStatusOverlay.jsx` as conditional renders and sit on top of the canvas. The canvas itself stays mounted in every state to avoid remount flicker.

### Idle state design

Pre-submit the hero shows a dark radial gradient with the eyebrow `"Pick a date and location"`. **No decorative ambient stars.** The CLAUDE.md rule on faked data is unambiguous; fake stars risk being read as real astronomy. The idle-to-rendered transition on first submit is the payoff.

### Error mapping

| Backend status | Message |
|---|---|
| 404 / 422 | "Location could not be computed." |
| 500 | "Sky computation failed. Please try again." |
| Network error | "Can't reach the server. Check your connection." |

### Projection memoization

```js
const projected = useMemo(
  () => ({
    stars: projectStars(skyQuery.data?.stars ?? [], width, height),
    planets: projectPlanets(planetsQuery.data?.planets ?? [], width, height),
  }),
  [skyQuery.data, planetsQuery.data, width, height]
);
```

Re-projects when data or container dimensions change. Hover and selection never re-project.

### Selection invalidation on data change

```js
useEffect(() => {
  setSelectedId(null);
  setHoveredId(null);
}, [skyQuery.data, planetsQuery.data]);
```

New data = new positions. Selection and hover clear so the tooltip can't linger over an empty spot.

### Debouncing

- React Query dedupes API calls already; no debounce on observer submit.
- `useCanvasSize`'s ResizeObserver output is debounced 150ms so window drags don't thrash.
- DPR changes are rare (multi-monitor drag). No debounce.

### Panels below are unchanged

`StarsPanel`, `PlanetsPanel`, and `LunarPanel` already consume `useSky` and `usePlanets`. React Query caches across subscribers — no duplicate fetches. Clicking a star on the chart does **not** scroll or highlight in `StarsPanel` in 2b (kept decoupled; revisit in Phase 3).

---

## 7. Testing Strategy

### Unit tests (Vitest, no DOM)

**`utils/projection.test.js`**
- Zenith (alt = 90°) projects to the rectangle center `(width/2, height/2)`.
- Due north horizon (alt = 0°, az = 0°) projects above zenith by the reference scale distance.
- Due east horizon (alt = 0°, az = 90°) projects right of zenith.
- At `REFERENCE_ALT`, `y_norm * scale` equals `min(width, height) / 2`.
- Non-square rectangles (16:9, 4:3) keep zenith centered.
- Very low altitude at wide azimuth: returns finite (x, y); caller handles off-rect draws.

**`utils/hitTest.test.js`**
- Empty array → returns null.
- Single star at cursor position → returns that star.
- Star outside radius → returns null.
- Two candidates both inside radius → returns the nearer one.
- Mixed stars + planets — planet has a larger effective radius and wins when appropriate.

**`utils/drawing.test.js`**
- `magnitudeToGlow(mag)` returns expected `{core, halo}` for calibration magnitudes (-1, 0, 2, 4, 6).
- `magnitudeToGlow(null)` returns a sane default (no throw, no NaN).
- `bvToHex` integration: null `bp_rp` falls back to `#ffffff` (already covered by existing tests — verify still holds).

### Component tests (Vitest + RTL)

**`SkyChart.test.jsx`**
- Idle state (no `selected`) renders the idle overlay with eyebrow text.
- Loading state renders the loading overlay with the selected place name.
- Error state renders `ErrorCard` with the mapped message; clicking retry calls `query.refetch()`.
- Success state renders the canvas with `role="img"` and expected `aria-label`.
- Cardinal labels N/S/E/W are present.
- Mousemove near a known-position star sets hoveredId; `SelectionRing` appears at expected coords at ~40% opacity.
- Click on a star sets selectedId; tooltip renders with `source_id`, magnitude, distance, and `Source: Gaia DR3`.
- Click empty sky dismisses the tooltip.
- Escape keypress dismisses the tooltip.
- New query data clears selectedId.

**`SkyTooltip.test.jsx`**
- Star tooltip renders all rows + Gaia source badge.
- Planet tooltip renders without source_id, shows AU.
- Moon tooltip includes illumination and phase_name when provided.
- Edge-flip logic: when anchor is near right edge, tooltip renders left-flipped.

### What we explicitly do NOT test

- Exact canvas pixel output (fragile, relies on browser rendering).
- Framerate benchmarks (visual-confirmation-only during dev; formal perf tests deferred).
- Real network calls in component tests. React Query hooks are stubbed; backend `/sky` and `/planets` are already covered by backend test suite.

### Backend tests

None added for Phase 2b. The `/sky`, `/planets`, and `/geocode` routes were shipped in Phase 1 + 2a. No API changes required.

### Manual smoke test checklist

- Load with no data — idle overlay visible with eyebrow.
- Submit `"Miami, 2026-04-13 21:00 UTC"` — chart renders; Sirius visible and brightest.
- Hover various stars — ring appears smoothly, no flicker.
- Click Sirius — tooltip shows, source_id present, magnitude ≈ -1.46, source badge `Gaia DR3`.
- Click empty sky — tooltip dismisses.
- Resize window (drag from wide to narrow) — chart re-layouts, no blank frames.
- Submit new location (e.g. Portoviejo) — previous chart dims during load, new data renders cleanly.
- 1366 × 768 laptop screen — chart fits above-the-fold, controls strip peeks below.
- Mobile viewport (~390px wide) — chart usable, tooltip fits, tap works.
- Test selecting Moon — tooltip shows illumination + phase name from Phase 2a API extensions.

### Test count target

~52 frontend tests passing (32 existing + ~20 new). 52 backend tests unchanged.

---

## 8. Open Questions / Risks

### Potential risks

1. **Performance at mag_limit 6.5.** ~2000–3500 stars with ~200 of them rendering full radial gradients is our estimate. If a specific location/time returns substantially more bright stars than expected, the full-redraw budget could blow. Mitigation: sprite cache (held in reserve).
2. **DPR handling edge cases.** Dragging between a 1x and 2x monitor has well-known gotchas. We mitigate with an explicit `matchMedia` listener, but we should smoke test this.
3. **Tooltip positioning on ultra-narrow viewports.** Edge-flip logic should cover it, but a 320px phone viewport with a tooltip at the left edge is a real case to smoke test.
4. **Idle state could feel empty.** We're deliberately not rendering decorative stars (faked-data rule). If the idle hero feels too bare in practice, we can add a subtle ambient texture — not stars — that's clearly non-astronomical. Re-evaluate after shipping.

### Validated open-ended choices

- Default `REFERENCE_ALT = 20°` is a starting point; tune after seeing real output.
- Hover ring opacity (40% / 80%) is calibrated from the mockup, adjust if it reads wrong in practice.
- 150ms redraw debounce is a standard value; not hotly defended.

---

## 9. Execution Notes

- Plan structure will follow the same Part A–N style used for Phase 2a, produced by the superpowers `writing-plans` skill.
- Branch: `feat/phase-2b-sky-chart` off `main`.
- Execution mode: `subagent-driven-development` — one task per subagent, Haiku for mechanical tasks (file scaffolds, pure utils with tests), two-stage review for substantive logic (projection math, hit test, canvas orchestration).
- Commit style: conventional commits (`feat(chart): ...`, `test(chart): ...`, `refactor(chart): ...`).
