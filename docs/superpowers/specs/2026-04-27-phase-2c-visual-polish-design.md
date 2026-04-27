# Phase 2c — Visual Polish + Milky Way Backdrop — Design Spec

**Date:** 2026-04-27
**Status:** Draft (pending Andrew's review)
**Author:** Brainstorming session with Claude
**Phase:** 2c (slotted between completed Phase 2b and upcoming Phase 3)

---

## 1. Summary

Phase 2c upgrades the SkyVault sky chart from a "stars on a black canvas" rendering to a cinematic, astrophotography-style sky scene. It introduces a real Milky Way backdrop (Axel Mellinger's All-Sky Milky Way Panorama 2.0), upgrades star and planet rendering for visual realism + readability, and reframes the projection so the entire canvas rectangle is visually utilized.

This is *visual polish*, not new astronomical functionality. Star/planet positions remain unchanged — driven by the existing Gaia DR3 + JPL DE421 pipeline.

---

## 2. Motivation

The Phase 2b chart works correctly but reads as "colored dots on black." Three concrete user-reported issues:

1. **Stars don't feel like stars.** They're just dots; the visual lacks the immersive "looking up at the night sky" quality that's central to SkyVault's portfolio pitch.
2. **Planets are indistinguishable from stars.** Users can't tell at a glance that the bright dot they're looking at is Jupiter — losing the "oh wow I didn't know that was visible" educational moment.
3. **Projection underuses the rectangle.** The stereographic dome reads as a circle inside a wider rectangle; the corners feel like dead space.

For a portfolio piece targeting aerospace / space-tech employers, the visual quality bar is high. A polished, immersive chart is essential to the project's "this person can ship real, beautiful astronomical software" pitch.

---

## 3. Scope

### In scope
1. Mellinger 2.0 panorama as a backdrop layer, projected through inverse stereographic AltAz, fills the canvas rectangle.
2. Star rendering upgrades:
   - Color amplification on bright stars (real BP-RP color visible on bright stars; dim stars stay near-white).
   - Atmospheric horizon haze (stars near the horizon dim and warm in tone).
   - Locked: no diffraction spikes, no twinkle.
3. Planet differentiation:
   - Stronger marker contrast (per-planet color tints, slightly larger sizes, crisp filled discs).
   - Always-on HTML labels for every visible planet/Moon (and Sun when up).
4. Projection reframing: REFERENCE_ALT lowered from 20° to 0°, so the horizon ring sits exactly at the canvas's short-edge inscribed circle. Corners show below-horizon Mellinger continuation, dimmed.
5. Horizon ring (faint hairline) as a visual element marking the alt = 0 boundary.
6. Mellinger attribution wired into UI source badge, `/about` page, README, and source-code comments.

### Out of scope
- Constellation stick figures (Phase 3).
- SIMBAD / NASA Exoplanet Archive enrichment (Phase 3).
- Three.js Explore Mode (Phase 4).
- Astronomical-symbol overlay for planets (deferred to a future Phase 3 toggle).
- Twinkle animation, diffraction spikes (rejected during brainstorming).
- Touch/pinch zoom on the chart (Phase 4 with Explore Mode).

---

## 4. Locked design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Star aesthetic | Astrophotography vibe (no spikes, no twinkle, color-rich pinpoints) | Andrew's reference: real Milky Way photos taken from Earth |
| Milky Way source | Axel Mellinger's All-Sky Milky Way Panorama 2.0, equatorial projection | Photo-realistic warm/dusty look matching reference |
| Mellinger license posture | Use under non-commercial terms with full attribution | Site is free, no ads, no monetization — fits license |
| Rendering approach for backdrop | WebGL fragment shader (Approach 2) | Best perf, best UX, isolated tech surface, real resume signal |
| Planet differentiation | Always-on labels + stronger marker contrast (no symbols in v1) | Strongest "what is that?" answer at zero clicks |
| Projection fill (option B) | Keep stereographic dome; extend backdrop past horizon to fill corners | Preserves dome mental model; corners become real visual asset |
| REFERENCE_ALT | Lowered from 20° to 0° | Horizon ring inscribes the short edges; cleanest geometry |
| Atmospheric horizon haze on stars | Yes, dim + warm tint as alt → 0 | Matches astrophotography reference; physically real |
| Color amplification on bright stars | Yes, scaled by magnitude | Astrophoto signature without confetti effect on dim stars |
| Twinkle | No | Real long-exposure photos don't twinkle; would fight the still-photo vibe |
| Diffraction spikes | No | Telescope-specific artifact, not present in DSLR/wide-field astrophotos |

---

## 5. Architecture

### 5.1 Layered rendering stack

`HeroRegion` becomes a stack of independent layers. Each layer gets the same `width / height / observer` props and renders independently. No layer talks to another directly. Z-ordered back to front:

| z | Layer | Tech | Purpose |
|---|---|---|---|
| 0 | `MilkyWayBackdrop` (NEW) | WebGL `<canvas>` | Mellinger panorama warped through inverse stereographic AltAz |
| 1 | `HorizonRing` (NEW) | Canvas 2D `<canvas>` | Faint hairline ring at alt = 0 |
| 2 | `SkyCanvas` (existing, modified) | Canvas 2D `<canvas>` | Stars + planets, with realism upgrades |
| 3 | `PlanetLabels` (NEW) | HTML overlay `<div>` | Always-on planet name labels |
| 4 | `CardinalLabels`, `SelectionRing`, `SkyTooltip`, `SkyStatusOverlay` (existing) | HTML | Cardinal letters, hover/selection feedback |

Coordination is through `SkyChart.jsx` (existing orchestrator), which already passes `width`, `height`, and observer state to its children.

### 5.2 Fault isolation

Each layer fails independently:
- WebGL unavailable → backdrop renders flat dark fill (`#05070d`); stars/planets/labels still work.
- Mellinger image fails to load → same dark fill fallback.
- Planet labels error → labels hidden, markers still drawn.
- Horizon ring error → ring hidden, everything else works.

No single layer can take down the others.

---

## 6. Components

### 6.1 NEW — `MilkyWayBackdrop.jsx`

**Location:** `client/src/components/hero/MilkyWayBackdrop.jsx`

**Props:** `{ width, height, lat, lon, datetime, dpr }`

**Behavior:**
- On mount: gets WebGL context (try `webgl2`, fall back to `webgl`); compiles vertex + fragment shaders; uploads Mellinger texture from `/assets/mellinger_2_equatorial.webp`.
- On prop change: updates uniforms, redraws the fullscreen quad. ~2 ms on integrated GPU.
- On WebGL unavailable: renders a `<div>` with flat dark fill, logs warning once.

**License notice:** File header comment block citing Mellinger license + linking back to `skyvault_mellinger_license.md` memory.

### 6.2 NEW — `inverseProjection.frag` (GLSL fragment shader)

**Location:** `client/src/utils/glsl/inverseProjection.frag` (or inlined as JS string in `MilkyWayBackdrop.jsx`).

**Inputs (uniforms):**
- `vec2 uResolution` — canvas size in CSS pixels
- `float uReferenceAlt` — projection scale parameter (0° for Phase 2c)
- `float uLST` — local sidereal time, radians, computed JS-side from `datetime + lon`
- `float uObserverLat` — observer latitude, radians
- `sampler2D uMellingerTex` — the panorama
- `float uBelowHorizonDim` — dim multiplier for alt < 0 (default 0.25)
- `float uHorizonHazeStart` — alt threshold where haze begins (default 30°)

**Algorithm (per pixel):**
1. Compute pixel polar coords `(r, θ)` from canvas center.
2. Inverse stereographic: `zenithAngle = 2 * atan(r / scale)`; `alt = π/2 - zenithAngle`; `az = θ`.
3. AltAz → equatorial RA/Dec using `uObserverLat` + `uLST`.
4. RA/Dec → texture coords: `u = RA / (2π)`, `v = (Dec + π/2) / π`.
5. Sample Mellinger texture.
6. Apply dim factor: full above 30° alt; smooth ramp to `uBelowHorizonDim` below 0°.
7. Output `vec4(rgb * dim, 1.0)`.

### 6.3 NEW — `coordinateTransforms.js`

**Location:** `client/src/utils/coordinateTransforms.js`

**Purpose:** Frontend astronomy helpers for the WebGL layer (only — backend remains the source of truth for everything else).

**Exports:**
- `computeLST(datetime, lonDeg) → radians` — local sidereal time, deterministic from UTC + observer longitude. ~10 lines, standard formula. Verified against Astropy reference values in tests.

### 6.4 NEW — `HorizonRing.jsx`

**Location:** `client/src/components/hero/HorizonRing.jsx`

**Props:** `{ width, height, dpr }`

**Behavior:**
- Renders one `ctx.arc` on a small `<canvas>`.
- Center: canvas midpoint; radius: `Math.min(width, height) / 2` (with REFERENCE_ALT = 0°, this is exactly the horizon).
- Stroke: 1 px hairline, `rgba(255, 255, 255, 0.08)`.
- No labels — silent geometry.

### 6.5 NEW — `PlanetLabels.jsx`

**Location:** `client/src/components/hero/PlanetLabels.jsx`

**Props:** `{ projectedPlanets, width }`

**Behavior:**
- For each planet with `alt > 0`, render a `<span>` at `(x + 10, y - 6)`. If `x > width * 0.8`, flip to `(x - 10, y - 6)` with `text-align: right` to avoid clipping.
- Style: 11 px, slightly tracked, `rgba(255, 255, 255, 0.75)` text, `text-shadow: 0 0 4px rgba(0,0,0,0.8)` for legibility against bright Milky Way regions.
- Sun/Moon get labeled too (same logic).

### 6.6 NEW — `horizonHaze.js`

**Location:** `client/src/utils/horizonHaze.js`

**Purpose:** Compute the dim + warm-tint multipliers applied to stars (and reusable for planets) as a function of altitude.

**Exports:**
- `horizonHaze(altDeg) → { brightnessMul, redShift }`
  - `alt ≥ 30°` → `{ 1.0, 0 }`
  - `alt = 10°` → `{ 0.7, 0.3 }`
  - `alt = 0°`  → `{ 0.3, 0.6 }`
  - `alt < 0°`  → clamped to alt = 0° values
  - Smooth interpolation between stops.

### 6.7 MODIFIED — `drawing.js`

**Location:** `client/src/utils/drawing.js` (existing).

**Changes:**

1. New helper `colorAmpFactor(magnitude)`:
   - `mag ≤ 1` → 1.0 (full BP-RP color)
   - `mag ≥ 4` → 0.0 (near-white)
   - Linear ramp between.

2. `drawStar` updates:
   - Compute `colorAmp = colorAmpFactor(magnitude)`; blend `bvToHex(bp_rp)` toward `#ffffff` by `1 - colorAmp`.
   - Compute `{ brightnessMul, redShift } = horizonHaze(alt)`; multiply gradient alphas by `brightnessMul`; blend tint toward `#ffaa66` by `redShift`.
   - Star expects `alt` in its data — already present in `projectStars` output.

3. `drawPlanet` updates:
   - Replace gradient halo with crisp filled disc + per-planet tint.
   - Add subtle 1.5× outer glow ring at low opacity in the planet's own tint.
   - Per-planet color map (replaces current single amber):
     - Mars `#d97a4a`, Venus `#f5e8c0`, Jupiter `#e8c98a`, Saturn `#c9a86a`, Mercury `#b8a890`, Uranus `#8eb5c4`, Neptune `#6a8cb4`.
   - Bumped sizes: Venus/Jupiter 16, Mars 14, Mercury/Saturn/Uranus/Neptune 13, Sun/Moon 16 (unchanged).

4. `drawSun` and `drawMoon` unchanged in shape; `drawMoon` may receive horizon haze application for consistency (optional, low priority).

### 6.8 MODIFIED — `projection.js`

**Location:** `client/src/utils/projection.js` (existing).

**Change:** `REFERENCE_ALT` constant lowered from `20` to `0`.

That's the entire change. The math already handles arbitrary REFERENCE_ALT; lowering it just rescales the projection.

### 6.9 MODIFIED — `SkyChart.jsx` and `HeroRegion`

**SkyChart.jsx:** orchestrate the new layered stack. Pass props through to `MilkyWayBackdrop`, `HorizonRing`, `SkyCanvas`, `PlanetLabels`. Existing children (`CardinalLabels`, `SelectionRing`, `SkyTooltip`, `SkyStatusOverlay`) stay where they are.

**HeroRegion:** verify `position: relative` and that it sizes the chart container to its viewport-capped dimensions (already done in Phase 2b).

### 6.10 NEW — Mellinger asset

**Location:** `client/public/assets/mellinger_2_equatorial.webp`

- Mellinger 2.0 panorama, equatorial coordinates, equirectangular projection.
- Target size: 4096 × 2048 px, webp, ~3–6 MB.
- Cached by browser; immutable hash via Vite asset pipeline.

---

## 7. Data flow

```
ObserverStore (Zustand)
       │  lat / lon / datetime
       ▼
React Query → /api/v1/sky, /api/v1/planets
       │
       ▼
SkyChart.jsx
  ├─→ MilkyWayBackdrop  (lat, lon, datetime, w, h, dpr)
  │      ├─ JS: computeLST(datetime, lon) → uLST
  │      └─ WebGL: shader pulls Mellinger pixels via inverse projection
  │
  ├─→ HorizonRing        (w, h, dpr)
  │
  ├─→ SkyCanvas          (projectedStars, projectedPlanets, w, h, dpr)
  │      ├─ drawStar (per star: colorAmp + horizonHaze applied)
  │      └─ drawPlanet (per-planet tint + size + glow ring)
  │
  └─→ PlanetLabels       (projectedPlanets, w)
         └─ One <span> per visible planet, edge-aware positioning
```

Existing data pipeline (Astropy on backend, projection.js on frontend) is unchanged. The new layer (backdrop) is fed by the same observer state but bypasses the API — it's pure frontend math + a static texture.

---

## 8. Coordinate handling (correctness-critical)

This is a SkyVault project — accuracy is non-negotiable. The new shader does astronomy math on the frontend; we have to be precise.

**LST (Local Sidereal Time) calculation:**
- Computed JS-side from UTC `datetime` + observer `lon`.
- Standard formula (Meeus Ch. 12 / USNO algorithm):
  - JD = Julian Date from UTC datetime
  - GMST = 18.697374558 + 24.06570982441908 × (JD − 2451545.0) (in hours; mod 24)
  - LST = (GMST + lon/15) mod 24 → convert to radians
- Tested against Astropy reference values for at least 5 (datetime, lon) pairs covering different epochs and longitudes. Tolerance: < 1 arcsecond (well within visual accuracy).

**AltAz → Equatorial in shader:**
- Standard formulas using `sin/cos lat`, `sin/cos alt`, `sin/cos az`.
- Returns `(RA, Dec)` in radians.
- Verified by computing the inverse and round-tripping a few sample points to within 1 arcsecond.

**Equatorial → Mellinger texture coords:**
- Mellinger is in equatorial equirectangular (RA = x-axis, Dec = y-axis).
- `u = RA / (2π)` (wrap to `[0, 1]`)
- `v = (Dec + π/2) / π` (map `[-π/2, π/2]` to `[0, 1]`)

**Equirectangular distortion notice:** Mellinger 2.0 distributors do not always agree on the exact orientation of the panorama (north up vs. south up, RA = 0 at left vs. center). During implementation we'll verify the chosen distribution's metadata and add an orientation-correction step if needed (a fixed RA offset and/or Dec flip).

---

## 9. Performance

| Operation | Frequency | Cost |
|---|---|---|
| Mellinger texture upload | Once per mount | ~50 ms (decode + upload) |
| Shader compile | Once per mount | ~10 ms |
| Backdrop redraw | Per observer change OR resize | ~2 ms (one fullscreen quad) |
| Star draw (Canvas 2D) | Per observer change OR resize | ~30 ms for ~3000 stars (existing) |
| Planet draw + labels | Per observer change OR resize | ~5 ms |

No animation loop. No `requestAnimationFrame` burn. Total per-update cost: well under a single 16 ms frame budget.

Asset cost: ~3–6 MB Mellinger webp shipped with the bundle. One-time download, cached aggressively.

---

## 10. Error handling and graceful degradation

| Failure | Behavior |
|---|---|
| WebGL unavailable | Backdrop renders flat dark fill (`#05070d`). Console warning once. Stars/planets/labels work normally. |
| Mellinger texture fails to load | Same dark-fill fallback. Console warning once. |
| Shader compile error | Same dark-fill fallback. Console error with the GLSL log. (Should never ship in prod; dev signal only.) |
| `computeLST` produces NaN | Backdrop renders dark fill; warning. Means input `datetime` was malformed — should have been caught upstream. |
| Planet label position out of bounds | Skip rendering that label; marker still drawn. |
| Horizon ring fails | Ring hidden; everything else fine. |

No layer failure cascades. Stars + planets always render correctly; backdrop is a "nice to have" from the resilience perspective.

---

## 11. Testing strategy

### Unit tests (Vitest)
- `coordinateTransforms.computeLST` — verified against Astropy reference values for ≥ 5 (datetime, lon) pairs.
- `horizonHaze` — edge cases at alt = -5°, 0°, 10°, 30°, 90°.
- `colorAmpFactor` (in `drawing.js`) — ramp values at mag = -1, 0, 1, 2, 3, 4, 5.
- `drawStar` — spy on canvas ctx; verify amplified color used for bright star + alpha multiplied by haze for low-alt star.
- `drawPlanet` — verify per-planet tint applied; size matches table.
- `inverseStereographic` (JS port of shader math, for testability) — known points: zenith → `(cx, cy)`; horizon at cardinal directions → expected screen radius.

### Component tests (React Testing Library)
- `MilkyWayBackdrop` — renders fallback dark fill when WebGL is mocked unavailable.
- `MilkyWayBackdrop` — renders a canvas with WebGL context when available (mock the WebGL API).
- `HorizonRing` — renders one arc at correct radius for given width/height.
- `PlanetLabels` — renders one label per visible planet (alt > 0); zero for below-horizon.
- `PlanetLabels` — flips label position for marker in right 20% of canvas.
- `PlanetLabels` — Sun/Moon labeled when above horizon.

### Integration tests
- `SkyChart` — all four new layers mount in correct z-order without errors given a typical `/api/v1/sky` + `/api/v1/planets` payload.
- `SkyChart` — observer state change triggers re-render of all dependent layers.

### Manual visual QA (no automated visual regression — explicit choice for v1)
- Render at multiple lat/lon/datetime combinations.
- Verify Milky Way appears in the right spot when the galactic plane is up; pushed to corners when down.
- Verify planets are clearly distinguishable from stars at a glance.
- Verify horizon ring sits at the canvas's short-edge inscribed circle.
- Verify atmospheric haze: stars near horizon look dimmer and warmer.
- Verify color amplification: Vega looks bluish-white, Betelgeuse looks orange.

### Reference test cases
- New York City (40.71°N, -74.01°W), 2026-08-15 02:00 UTC: galactic core should be visible in the southern sky; Milky Way band runs through Sagittarius/Scorpius.
- Buenos Aires (-34.61°S, -58.38°W), 2026-08-15 02:00 UTC: galactic core nearly overhead; Milky Way arches across the zenith.
- Anchorage (61.22°N, -149.90°W), 2026-12-15 06:00 UTC: galactic plane low / partly below horizon; expect dim corners.

---

## 12. Mellinger 2.0 attribution requirements (license-critical)

These are non-negotiable. Without them, SkyVault is shipping infringing software. Each is treated as a hard task in the implementation plan.

### 12.1 Source badge on the chart
Persistent text in a corner of the hero region (low-opacity, ~10 px):
> *"Milky Way panorama © Axel Mellinger · Stars: ESA Gaia DR3 · Planets: NASA JPL DE421"*

Lives in a new dedicated `AttributionFooter` component inside `HeroRegion`. Dedicated component (not piggy-backed on `SkyStatusOverlay`) so the license-critical text is easy to grep and hard to accidentally delete during future refactors.

### 12.2 `/about` page entry (deferred — Phase 5 per roadmap)
The `/about` page does not exist yet (planned for Phase 5: Polish + Deploy). License compliance for Phase 2c is satisfied by the in-product source badge (12.1) and the README mention (12.4). When `/about` is created in Phase 5, it must list Mellinger alongside Gaia/JPL/IAU with:
- Full name: "All-Sky Milky Way Panorama 2.0"
- Author: Axel Mellinger
- License terms: free for non-commercial use with attribution
- Link: <https://galaxy.phys.cmich.edu/~axel/mwpan2/>

This requirement is captured in the saved memory and surfaced in the Phase 5 spec when written.

### 12.3 Source-code marker
At the top of `MilkyWayBackdrop.jsx` and the asset-loading module: comment block citing license, linking back to the saved `skyvault_mellinger_license.md` memory.

### 12.4 README mention
Single paragraph in project README under "Data Sources" listing all four sources (Gaia / JPL / IAU / Mellinger) with their licenses and links.

### 12.5 Trigger conditions for license re-evaluation
If SkyVault ever pivots to commercial use (subscription, paid SaaS, sold to a company): Mellinger backdrop MUST be removed or licensed explicitly from Mellinger before launch. Document this in the saved memory; do not allow that pivot to silently happen.

---

## 13. File-level changes summary

### New files
- `client/src/components/hero/MilkyWayBackdrop.jsx`
- `client/src/components/hero/HorizonRing.jsx`
- `client/src/components/hero/PlanetLabels.jsx`
- `client/src/utils/coordinateTransforms.js`
- `client/src/utils/horizonHaze.js`
- `client/src/utils/glsl/inverseProjection.frag` (or inline as JS string)
- `client/src/utils/glsl/passthrough.vert` (or inline as JS string)
- `client/src/components/hero/AttributionFooter.jsx`
- `client/public/assets/mellinger_2_equatorial.webp`
- Test files for each new component / utility above.

### Modified files
- `client/src/utils/drawing.js` — color amp + horizon haze + per-planet tints + size bumps
- `client/src/utils/projection.js` — REFERENCE_ALT 20° → 0°
- `client/src/components/hero/SkyChart.jsx` — orchestrate new layered stack
- `client/src/components/hero/HeroRegion.jsx` — verify positioning context
<!-- About.jsx does not exist yet — Phase 5. Mellinger will be added when /about is built. -->

- `README.md` — Data Sources section with all four sources
- `SKYVAULT_ROADMAP.md` — add Phase 2c
- `CLAUDE.md` — update phase status; add Mellinger + WebGL notes

### Deleted files
None.

---

## 14. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Mellinger panorama orientation differs from spec assumption (RA-0 not at left, Dec flipped, etc.) | Medium | Add a one-time orientation calibration step during implementation; verify visually against a known sky reference (e.g., galactic center placement at known datetime). |
| WebGL unavailable on a non-trivial fraction of users | Low (2026) | Graceful fallback to dark fill; rest of chart works. |
| Mellinger asset is too large for acceptable load time | Low | webp at 4096×2048 should be 3–6 MB. If problematic, reduce to 2048×1024 (~1 MB). Visual quality at hero size is still good. |
| Frontend LST math diverges from Astropy backend | Low | Cross-checked against Astropy in unit tests. Standard Meeus formula. |
| Phase 2c scope balloons (e.g., adding tooltip features for backdrop, or constellation lines sneaking in) | Medium | Hard scope freeze in this spec; anything new = Phase 3 ticket. |
| Mellinger license terms misunderstood and project ends up infringing | Low (we've documented terms carefully) | Saved memory + source-code marker + README mention all reinforce the rules. |

---

## 15. Open questions (none currently)

All design questions resolved during brainstorming. Implementation plan can proceed.

---

## 16. Acceptance criteria

Phase 2c is complete when:

1. ✅ Mellinger 2.0 panorama renders as the chart backdrop, visibly warped through inverse stereographic AltAz, with the galactic plane appearing in the correct sky position for the chosen observer state.
2. ✅ Below-horizon backdrop continuation fills the canvas corners, dimmed.
3. ✅ Bright stars (mag ≤ 1) wear visible BP-RP color (Vega blue-white, Betelgeuse orange, Antares red).
4. ✅ Stars near the horizon visibly dim and warm in tone vs. the same star at zenith.
5. ✅ Planets are clearly distinguishable from stars at a glance — different shapes, per-planet tints, larger size class.
6. ✅ Every visible planet (and Sun/Moon when above horizon) has a name label next to its marker.
7. ✅ Horizon ring (faint hairline) sits at the canvas's short-edge inscribed circle (REFERENCE_ALT = 0°).
8. ✅ Mellinger attribution shipped in: chart source badge, README, source-code marker. (`/about` page is Phase 5; license compliance satisfied by badge + README.)
9. ✅ All new unit + component tests pass; existing tests still pass.
10. ✅ No diffraction spikes, no twinkle (locked rejections from brainstorming).
11. ✅ Manual visual QA passes for all three reference test cases (NYC, Buenos Aires, Anchorage).
12. ✅ WebGL fallback renders dark fill when WebGL is mocked unavailable; no console errors otherwise.

---

## 17. Next step

After this spec is approved by Andrew: invoke the `superpowers:writing-plans` skill to produce a detailed implementation plan. The plan will break Section 13's file changes into ordered, TDD-friendly tasks with reference values for the astronomy math.
