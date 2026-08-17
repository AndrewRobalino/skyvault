# CLAUDE.md — SkyVault

> This file is read automatically by Claude Code when working in this repo. It provides persistent project context, conventions, and guardrails.

---

## Project Overview

**SkyVault** is an interactive web app that renders an accurate night sky for any date, time, and location on Earth. All star and planet positions are computed from real astronomical data sources — **ESA Gaia DR3** for stars, **NASA JPL DE421** for planets, all via Astropy. The goal is scientific accuracy with a cinematic, immersive frontend, backed by recognizable institutional data sources (NASA, ESA, IAU).

**Core user flow:** User enters date + time + location → backend computes visible stars and planet positions → frontend renders an interactive 3D celestial sphere with clickable objects showing real astronomical data and source attribution.

**Portfolio context:** This is Andrew's first flagship project targeting the space industry via CS. It must hold up to scrutiny from aerospace / space-tech employers. Accuracy is non-negotiable. Every data point must be attributable to a recognized institutional source.

---

## Tech Stack

### Frontend (`client/`)
- **React 18** + **Vite** (JavaScript, not TypeScript for v1 — keep velocity high)
- **Tailwind CSS** — dark-first design system
- **Canvas 2D** for sky chart rendering (Phase 2b); **WebGL** for the Milky Way backdrop layer (Phase 2c); **Three.js** deferred to Phase 4 Explore Mode
- **Zustand** for global state (two stores: `observerStore` semantic + `uiStateStore` visual)
- **@tanstack/react-query** for API data fetching and caching

### Backend (`server/`)
- **Python 3.11+**
- **FastAPI** (async)
- **Astropy** for all coordinate transforms and ephemeris calculations
- **astroquery** for live queries to Gaia, SIMBAD, NASA Exoplanet Archive, JPL Horizons
- **NumPy** / **Pandas** for catalog operations
- **Pydantic** for request/response schemas
- **pytest** for tests

---

## Data Sources — Two-Tier Strategy

All sources are real institutional datasets. **No faked, mocked, or approximated values** outside of tests. Every API response includes a `source` field. Every UI info card displays its source attribution.

### Tier 1 — Bulk Render Data (hot path, pre-loaded in memory)

| Source | Provides | Institution | Access |
|---|---|---|---|
| **Gaia DR3** (G < 8 subset, ~230k stars) | Star positions (ICRS), magnitudes, parallax, proper motion, BP-RP color | **ESA** | One-time ingest via Gaia TAP (astroquery.gaia), stored as parquet in `server/data/` |
| **JPL DE421 ephemeris** | Sun, Moon, Mercury–Neptune positions | **NASA JPL** | Astropy's `solar_system_ephemeris.set('de421')` |
| **Constellation figures** | 88 constellation stick-figure line patterns (Stellarium Western sky culture) + star coordinates (ESA Hipparcos) + names (IAU). NOTE: IAU officially defines only constellation *boundaries* and *names* — not stick figures. The figures are Stellarium's Western convention, a recognized de-facto standard. | **Stellarium (figures, CC BY-SA) · ESA Hipparcos (coords) · IAU (names)** | Baked to `server/data/constellations.json` via `scripts/ingest_constellations.py` |
| **ESO/S. Brunier GigaGalaxy Zoom panorama** (eso0932a) | Photo-realistic Milky Way backdrop (galactic equirectangular, 4000×2000) | **ESO/S. Brunier** | Static asset at `client/public/milky-way.jpg`, sampled by WebGL shader (Phase 2c). Also used as ambient page backdrop via CSS. **CC BY 4.0 — attribution required.** |

### Tier 2 — Enrichment APIs (cold path, lazy, cached)

Activated progressively across phases. Each lives in its own module under `server/app/services/enrichment/`.

| Source | Provides | Institution | When |
|---|---|---|---|
| **SIMBAD** (CDS) | Canonical object metadata — alternate names, spectral class, object type | CDS Strasbourg | Phase 3 — click-to-lookup on any star |
| **NASA Exoplanet Archive** | Confirmed exoplanets + host stars (~5,600 planets) | **NASA/IPAC** | Phase 3 — overlay "has exoplanets" badge on host stars |
| **JPL Horizons** | Live ephemerides for small bodies (asteroids, comets, spacecraft) | **NASA JPL** | Phase 4 — presets like "Tonight's visible asteroids" |

### Geocoder — Place lookup (separate from sky data)

User-facing place search for the location input. **Photon primary** (autocomplete-grade, fuzzy, fast), **Nominatim fallback** when Photon is unreachable or 5xx. Shared in-memory TTL cache. Both OSM-backed. Source field on the response reflects which provider answered. See `server/app/services/geocoder.py`.

### Attribution rules
- The `/about` page lists every source with institution name, dataset version, and link to the original.
- Every API response object includes a `source` field (e.g., `"Gaia DR3"`, `"JPL DE421 via Astropy"`, `"SIMBAD/CDS"`).
- Every UI info card displays a source badge.
- Persistent footer: *"Powered by ESA Gaia DR3 · NASA JPL · IAU · CDS SIMBAD · NASA Exoplanet Archive · Milky Way panorama: ESO/S. Brunier (CC BY 4.0)"*

---

## Repository Structure

```
skyvault/
├── client/                    # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── StarMap/       # Three.js scene, star/planet rendering
│   │   │   ├── Controls/      # Date/time/location input form
│   │   │   ├── InfoPanel/     # Object info cards with data attribution
│   │   │   ├── Layout/        # Nav, footer, about page
│   │   │   └── UI/            # Shared primitives (Button, Card, etc.)
│   │   ├── hooks/             # useSkyData, usePlanets, useConstellations
│   │   ├── stores/            # Zustand stores
│   │   ├── utils/             # Coordinate helpers, color mapping
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── server/                    # FastAPI backend
│   ├── app/
│   │   ├── main.py            # FastAPI entry, CORS, router mounting
│   │   ├── config.py          # Paths, magnitude limits, cache TTLs
│   │   ├── routers/
│   │   │   ├── sky.py         # GET /api/v1/sky
│   │   │   ├── planets.py     # GET /api/v1/planets
│   │   │   ├── constellations.py
│   │   │   └── objects.py     # GET /api/v1/objects/{id} — enrichment lookups
│   │   ├── services/
│   │   │   ├── star_catalog.py   # Gaia DR3 subset loading + filtering
│   │   │   ├── ephemeris.py      # DE421 planet calculations
│   │   │   ├── coordinates.py    # ICRS -> AltAz transforms
│   │   │   └── enrichment/
│   │   │       ├── simbad.py           # Phase 3
│   │   │       ├── exoplanet_archive.py # Phase 3
│   │   │       └── horizons.py         # Phase 4
│   │   └── models/
│   │       └── schemas.py     # Pydantic models
│   ├── data/
│   │   ├── gaia_dr3_g8.parquet   # Gaia DR3 subset (downloaded via ingest script, gitignored)
│   │   └── constellations.json   # Stellarium Western stick figures + Hipparcos coords (committed)
│   ├── scripts/
│   │   └── ingest_gaia.py     # One-time Gaia TAP download -> parquet
│   ├── tests/
│   └── requirements.txt
│
├── docker-compose.yml
├── CLAUDE.md                  # This file
├── SKYVAULT_ROADMAP.md
└── README.md
```

---

## Coding Conventions

### General
- Keep files focused. If a component or module exceeds ~250 lines, consider splitting.
- Prefer clarity over cleverness. This is a portfolio project — readable code matters for reviewers.
- No dead code, no commented-out blocks left behind. Delete or commit.

### Frontend (React)
- Functional components + hooks only. No class components.
- Co-locate component files: `StarMap/StarMap.jsx`, `StarMap/starShader.js`, `StarMap/index.js`.
- One component per file. Default export the component.
- Props destructured in the function signature.
- Use Tailwind utility classes directly. No styled-components, no CSS modules, no inline style objects unless dynamic.
- State hierarchy: local `useState` → component; shared state → Zustand store; server data → React Query. Never mix.
- Never call `fetch` directly in components — always go through a React Query hook in `hooks/`.

### Backend (Python)
- Type hints on every function signature. Return types included.
- Pydantic models for all request/response bodies — never return raw dicts from routes.
- Route handlers stay thin. Business logic lives in `services/`.
- Use `async def` for route handlers. CPU-heavy Astropy calls can run sync inside — it's fine for v1.
- Constants (catalog paths, magnitude limits, cache TTLs) live in `app/config.py`.
- Use `pathlib.Path`, not `os.path`.
- Enrichment service modules must cache responses (in-memory LRU is fine for v1). External APIs are rate-limited.

### Styling / UI
- Dark theme is the default and the only theme for v1. Background: near-black (`#05070d` or similar). Accent: cool blues and whites.
- The star map viewport should feel *immersive* — minimal UI chrome overlapping it. Controls slide in from the edges.
- Typography: one sans-serif for UI (Inter), optionally one serif or display font for headings (Instrument Serif or similar). Keep it tight — max 2 fonts.
- Info cards: semi-transparent dark backdrop with subtle blur (`backdrop-blur`), thin border, rounded corners.
- Every info card MUST display its data source badge (e.g., `"Gaia DR3 · source_id 4089383515393106688"`).

---

## API Contract

### `GET /api/v1/sky`
**Query params:**
- `lat` (float, required) — observer latitude in degrees
- `lon` (float, required) — observer longitude in degrees
- `datetime` (ISO 8601 string, required) — observation time in UTC
- `mag_limit` (float, optional, default 6.5) — maximum apparent magnitude

**Response:**
```json
{
  "observer": { "lat": 25.76, "lon": -80.19, "datetime": "2026-04-06T21:00:00Z" },
  "stars": [
    {
      "id": "4089383515393106688",
      "name": "Sirius",
      "designation": "α CMa",
      "ra": 101.287,
      "dec": -16.716,
      "alt": 42.1,
      "az": 183.4,
      "magnitude": -1.46,
      "bp_rp": 0.00,
      "parallax_mas": 379.21,
      "distance_ly": 8.6,
      "source": "Gaia DR3"
    }
  ],
  "count": 2847
}
```

### `GET /api/v1/planets`
Same observer params. Returns Sun, Moon, Mercury–Neptune with AltAz coordinates, distance from Earth, and `"source": "JPL DE421 via Astropy"`.

### `GET /api/v1/constellations`
Returns constellation stick-figure line segments (Stellarium Western sky culture; ESA Hipparcos coords; IAU names) and label positions, transformed to the observer's AltAz frame. Observer-parameterized (`lat`, `lon`, `datetime`). A segment is `visible` only if both endpoints are above the horizon.

### `GET /api/v1/objects/{id}` (Phase 3+)
Enrichment lookup. Returns SIMBAD metadata + NASA Exoplanet Archive data if the object is an exoplanet host. Responses cached server-side.

---

## Data Accuracy Requirements

This project lives or dies on accuracy. Non-negotiable:

1. **All star positions** must come from the Gaia DR3 subset (ICRS, epoch J2016.0), transformed to the observer's local AltAz frame using Astropy. Apply proper motion correction from J2016.0 to observation epoch. Never fake or approximate.
2. **All planet positions** must use `astropy.coordinates.get_body()` with the JPL DE421 ephemeris. Never use simplified Kepler approximations.
3. **Time handling** is brutal — always store and transmit UTC. Convert to local time only for display. Use `astropy.time.Time` on the backend, not Python `datetime` math.
4. **Coordinate frames matter.** Gaia catalog is ICRS. Planet positions are GCRS. Observer frame is AltAz with proper `EarthLocation` and `Time`. Astropy handles this if you set it up right.
5. **Unit tests must verify** known star positions against published values (Sirius, Vega, Polaris at known date/location should match Stellarium/published ephemerides within arcminute accuracy).

---

## Phase Status

- [x] **Phase 1** — Foundation: Gaia ingest script, backend API serves accurate star + planet positions (Gaia DR3 + JPL DE421, real data, tests green)
- [x] **Phase 2a** — Frontend Foundation: Vite + React shell, intro animation, controls strip, info panels, 32 frontend tests + 52 backend tests passing
- [x] **Phase 2b** — 2D Sky Chart: Canvas 2D stereographic projection inside the hero placeholder
- [x] **Phase 2c** — Visual Polish + Milky Way Backdrop: WebGL panorama backdrop (ESO/S. Brunier, galactic equirectangular) + ambient CSS galaxy layer; point-based star rendering (halos only on mag ≤ 2); per-planet color tints + always-on labels; full-rectangle stereographic fill (REFERENCE_ALT = 0°); attribution footer. **Merged to main 2026-05-17 (PR #1).**
- [x] **Phase 2d** — Celestial Objects: planet sprite icons (procedural + photo-texture tooltip thumbnails) + Moon texture with phase shadow + apparent-size scaling + 25 naked-eye DSOs as soft glows with bright nuclei. Backend: `GET /api/v1/dso`, dso_catalog service, ingest_dso.py (TAP query + reference fallbacks), naked_eye_dso.json seeded with 25 objects. Frontend: textureCache, sprite renderers (planet + moon), dsoDrawing, useDso hook, projectDsos, SkyChart/SkyCanvas wired, SkyTooltip extended with DsoBody + planet photo. **Merged to main 2026-05-29 (PR #2, commit `f17dccb`).**
- [x] **Phase 3a** — Constellations: toggleable Western stick-figure overlay (lines + name labels), observer-parameterized `GET /api/v1/constellations` (ICRS→AltAz, both-endpoints-visible rule). Backend: `constellation_catalog` service, `ingest_constellations.py` (Stellarium `index.json` HIP polylines → VizieR Hipparcos → baked `constellations.json`, 88 constellations / 674 segments). Frontend: `showConstellations` store toggle (default OFF), gated `useConstellations` hook, `projectConstellations`, SkyCanvas line layer (behind objects), `ConstellationLabels` DOM overlay, `ConstellationToggle` control. Triple-attributed: Stellarium Western (CC BY-SA) + ESA Hipparcos + IAU. **QA-passed 2026-06-05; merged to main 2026-08-17 (PR #3, commit `1f0c984`).**
- [x] **Accuracy audit** — 2026-07-13 full-codebase correctness + optimization pass: inside-view chart orientation (E left), verified Milky Way projection, shared UTC parsing with 422/503 mapping, 14x `/sky` serialization, pooled geocoder client. **Merged to main 2026-08-17 (PR #4, commit `0dd3a1e`).** Guardrails #22–24.
- [ ] **Phase 3b** — Enrichment: click-to-lookup SIMBAD names/spectral type + NASA Exoplanet Archive host data, **fully baked** (zero runtime external calls), shown by expanding the star tooltip. **Spec + plan DONE and now on main; branch `feat/phase-3b-enrichment` repointed to the main tip. Execution is the next task.** See `docs/superpowers/specs/2026-06-05-phase-3b-enrichment-design.md` + plan.
- [ ] **Phase 4** — Explore Mode: Three.js 3D flyable celestial sphere (behind the "Explore in 3D" button)
- [ ] **Phase 5** — Polish + Deploy: landing, about, docker-compose, live URL

**Rendering pivot:** Three.js is no longer the Phase 2 engine. Canvas 2D ships first in Phase 2b. Three.js is deferred to Phase 4 as a differentiated 3D flythrough. See `SKYVAULT_ROADMAP.md` for the rationale (will be rewritten in Task H2 of the Phase 2a plan).

See `SKYVAULT_ROADMAP.md` for full phase breakdowns and task lists.

---

## Resume Here — Next Session

**Paused:** 2026-08-17. **Everything built so far is now on `main`.** Phase 3a merged via PR #3 (`1f0c984`), then the 2026-07-13 accuracy audit merged via PR #4 (`0dd3a1e`) — which also carried the three docs-only Phase 3b spec/plan commits it was branched on top of. `feat/phase-3b-enrichment` has been fast-forwarded to the main tip and is ready to execute against.

**Verified on the merged `main` (2026-08-17):** backend **109/109** in a single session (106 default + 3 `network`-marked), frontend **185/185** (29 files), ESLint clean, production build 238.86 KB JS / **76.01 KB gzip**, and `verify_backdrop_projection.py` green at **0.375°** worst separation (budget 0.6°).

**Found and fixed while verifying the merge** (`b569523`): the audit's pooled `httpx.AsyncClient` was cached in module state with nothing resetting it between tests. pytest-asyncio gives each test its own event loop, so the second test to reuse it hit connections bound to a closed loop → `RuntimeError: Event loop is closed`. `_get_client()` can't detect this, because a client whose loop died still reports `is_closed == False`. Fixed with autouse teardown fixtures in both geocoder test modules. Not a production defect (uvicorn = one loop for the process lifetime, closed by the lifespan hook on that same loop) — but **if a future change ever runs the app across more than one event loop, `geocoder._client` is the thing that will break first.**

**NEXT: execute the Phase 3b plan** — `superpowers:subagent-driven-development` on `docs/superpowers/plans/2026-06-05-phase-3b-enrichment.md`, 9 TDD tasks, on branch `feat/phase-3b-enrichment`. Note the plan reserves "guardrail #22" for the enrichment rule; the audit took #22–24, so it lands as **#25**.

### 2026-07-13 audit — what changed (QA-passed, merged via PR #4)

**Accuracy fixes (frontend):**
1. **East-west mirror fixed.** The chart rendered the outside-globe convention (N up, E right) — a mirror image of the real sky. Now inside view (E left): `projectAltAz` x-sign, `inverseStereographic`, `CardinalLabels` E/W swap, orientation tests updated. See guardrail #22. **The rendered sky is now horizontally flipped vs every prior screenshot — this is correct, not a regression.**
2. **Milky Way backdrop was misprojected and is now verified-correct.** Three stacked bugs in `inverseProjection.frag.js`: vUv y-up vs canvas y-down (backdrop vertically flipped vs stars), wrong galactic-l formula (returned 155.9° for the galactic center instead of ~0°), wrong texture-layout assumption (l=0 assumed at left edge; eso0932a has it centered, l increasing leftward). End-to-end numerical verification vs Astropy: sampled positions were 16°–118° off before, 0.04°–0.37° after. See guardrail #23.

**Robustness + performance (backend):**
3. New `app/services/time_utils.py` (`parse_utc_time`) replaces 4 copies of `.replace("Z","")`; malformed `datetime` now → 422 (was 500), `±HH:MM` offsets accepted. All 4 routers wired; missing catalog/kernel → 503 everywhere (sky/planets/dso previously 500). Guardrail #24.
4. `/sky` serialization: `iterrows()` → `to_dict("records")` — 499 ms → 36 ms for 6k stars (14x); endpoint ~670 ms → ~206 ms end-to-end.
5. Geocoder: shared `httpx.AsyncClient` (connection pooling for autocomplete) + close via FastAPI lifespan in `main.py`.

**Tests:** backend 94 → **106** (new: time_utils unit tests; DSO router 422/offset/503 cases), frontend **185** (orientation tests rewritten). All green; lint clean; build 238.9 KB / 76.0 KB gzip.

**Verification artifacts:** `server/scripts/verify_backdrop_projection.py` — reproducible Astropy ground-truth check of the backdrop pipeline (run after touching the shader, `projection.js`, or `computeLST`; exits 1 if worst separation > 0.6°). **Live visual QA by Andrew 2026-07-13: passed** (flipped orientation + corrected backdrop on the dev server).

**Known accepted approximations (documented, not bugs):** no atmospheric refraction (<0.5°, needs weather data); backdrop uses of-date coords with J2000 galactic rotation (~0.4° in 2026, sub-pixel-blur on a diffuse image); simplified GMST without UT1−UTC (≤~13 arcsec); Moon chart-icon terminator vertical + lit-side heuristic (Phase 4); DSO pxPerArcmin linearization; "Local" timezone toggle = browser-local, not searched-location-local (Phase 5 candidate: tz lookup from lat/lon).

**Current state:** Phase 1 + 2a + 2b + 2c + 2d + **3a** + the accuracy audit are all shipped to `main` (PR #3 `1f0c984`, PR #4 `0dd3a1e`, both 2026-08-17). Spec + plan for 3b in `docs/superpowers/`, also on main. Frontend **185** tests / backend **106** default + **3** network-marked, all green; lint clean (0 warnings); production build 238.86 KB JS (76.01 KB gzip). Built subagent-driven, TDD per task, two-stage review. During the bake, found Stellarium `lines` carry style markers (e.g. `"thin"`) — parser strips them; without that fix Canis Major + Ursa Major were silently dropped.

**2026-06-05 session:** Live visual QA passed (NYC/Buenos Aires/Reykjavík). Brightened constellations for opt-in visibility (lines alpha 0.22→0.44; labels 0.45→0.85, 9px→11px, weight 500, double dark text-shadow). Accuracy audit verified: 674/674 source segments baked (zero dropped, every Hipparcos star resolved), Orion anchor stars match published J2000 ICRS to sub-arcsecond. Corrected stale doc wording — constellation figures are Stellarium Western (CC BY-SA), NOT IAU (IAU defines only boundaries + names); and leftover Mellinger 2.0 references → ESO/S. Brunier (the backdrop switched 2026-05-17). README was already correct. Two commits: `b18e173` (style) + `1d01b67` (docs), pushed.

### Next up — Phase 3b (Enrichment): spec + plan DONE, EXECUTE next session

Brainstorm → spec → plan are complete and now merged to `main` (commits `da4c4a2` spec, `7740254` plan). Branch **`feat/phase-3b-enrichment`** has been fast-forwarded to the main tip — no unique commits, nothing to rebase. Next: run `superpowers:subagent-driven-development` on the plan, task by task.

- **Spec:** `docs/superpowers/specs/2026-06-05-phase-3b-enrichment-design.md`
- **Plan:** `docs/superpowers/plans/2026-06-05-phase-3b-enrichment.md` (9 TDD tasks)

**Locked design:** Both features (SIMBAD names + NASA exoplanet hosts), surfaced by **expanding the existing star tooltip** on click (proper name header → spectral type → `✦ N confirmed planets`/`No known planets`). **Fully baked architecture** — pre-resolve all ~9k naked-eye stars at ingest (`scripts/ingest_star_enrichment.py` → `server/data/star_enrichment.json`), so the runtime `GET /api/v1/objects/{source_id}` makes **zero external calls** (in-memory lookup; returns `{found, enrichment}`). Exoplanet status is tooltip-only for now (host data baked anyway → on-chart badge is a later frontend-only toggle). Honest-partial coverage — unresolved stars degrade to Gaia-only, never faked.

**Execution gotcha:** the real bake (Task 5) needs network (live SIMBAD TAP + NASA Exoplanet Archive) + the Gaia parquet. All other tasks are network-free (fixtures/mocks). If the exec env lacks network, build against fixtures and run the one bake command locally.

**Guardrail numbering:** the 3b plan reserves "#22" for the enrichment rule, but the accuracy audit took #22–24 — so the enrichment guardrail lands as **#25**.

### Tech debt noted during 3a
- ~~`time_utc.replace("Z", "")` duplicated across 4 services~~ — **RESOLVED 2026-07-13** by `app/services/time_utils.parse_utc_time` (guardrail #24).

### Known follow-ups (deferred, not blockers)
- Planet apparent-size scaling and Saturn's ring tilt are stylized for v1; real ring-plane geometry waits for Phase 4 Three.js.
- Moon terminator is a vertical/simplified approximation in the chart icon (v1); fine for current QA.

Phase 2d post-merge cleanup done: dead code from the visual overhaul (`SUN_CORE`/`SUN_MID`, unused `getTexture` import, stale test imports) removed in commit `abf735b`.

---

## Guardrails for Claude Code

When working in this repo:

1. **Stay in scope.** If a task is Phase 1, do not start implementing Phase 2 features "while you're in there." Surface the idea, don't build it.
2. **Do not add dependencies casually.** If a new library is needed, explain why and confirm before installing. The stack above is the stack.
3. **Never fake data.** Don't hardcode star positions, don't mock ephemeris results outside of tests. If real data isn't available, stop and say so.
4. **Data source attribution is load-bearing.** Every astronomical data point returned by the API must include its `source` field. Every UI info card must display it. This is a product requirement, not a nice-to-have.
5. **Write tests as you go.** Backend services (`star_catalog.py`, `ephemeris.py`, `coordinates.py`) all need unit tests with real reference values.
6. **Ask before big refactors.** If you see something worth restructuring, flag it — don't silently rewrite.
7. **Commit messages** — conventional commits style: `feat(sky): add AltAz transform pipeline`, `fix(frontend): correct star color mapping`, etc.
8. **No TypeScript migration** in v1. We committed to JS. Revisit post-launch.
9. **Preserve the dark immersive aesthetic.** Do not introduce light-mode styles, bright accent colors, or heavy UI chrome over the star map.
10. **Respect rate limits on enrichment APIs.** SIMBAD, NASA Exoplanet Archive, and JPL Horizons must be cached. Never hammer these from the render path.
11. **Milky Way panorama is ESO/S. Brunier (eso0932a, CC BY 4.0) — attribution required.** The backdrop (`client/public/milky-way.jpg`, 4000×2000 galactic equirectangular) is © ESO/S. Brunier, licensed under Creative Commons Attribution 4.0. Commercial use is allowed; attribution is not optional. **Implementation requirements:** (a) credit `Milky Way: ESO/S. Brunier · CC BY 4.0` in the persistent footer/AttributionFooter, (b) full credit + license link on the future `/about` page, (c) link to https://www.eso.org/public/images/eso0932a/ and https://creativecommons.org/licenses/by/4.0/ on `/about`, (d) source-file comment in `MilkyWayBackdrop.jsx` pointing to the license. **If the image is modified** (cropped, color-graded, etc.) the change must be indicated under CC BY 4.0 — projecting it through the shader is rendering, not modification of the source asset. See memory file `skyvault_eso_license.md`.
12. **Star rendering is point-based (Stellarium-style).** Halos ONLY on mag ≤ 2 (~30 brightest); all others are anti-aliased dot circles via `arc + fill`. Do NOT add halo gradients to dim stars — they additively blob with `globalCompositeOperation: "lighter"` and produce the globular-cluster look we fixed 2026-05-17. Also: Canvas `gradient.addColorStop(offset, ...)` requires offsets in [0, 1] — when using `core/halo` as a stop position, ensure `halo > core` first or fall through to the dim path.
13. **Two-layer Milky Way is deliberate.** `AppBackground` (CSS, ambient, page-wide) + `MilkyWayBackdrop` (WebGL, projected, inside chart). Both load `/milky-way.jpg`. Don't consolidate without asking — they serve different purposes (mood vs scientific projection). Galaxy backdrop visibility depends on `html` holding the bg-color while `body` and `#root` stay transparent; opaque bg on either hides the `z-index: -1` AppBackground.
14. **Intro animation plays on every page load and does NOT gate on `prefers-reduced-motion`.** The intro is a soft opacity fade — fades aren't vestibular hazards per WCAG. The preference is still detected and stored on `useUiStateStore` (`prefersReducedMotion`) so Phase 4 Three.js (which DOES have motion) can read and respect it. Do not re-add a blanket `@media (prefers-reduced-motion: reduce)` rule that kills all keyframes.
15. **Geocoder is dual-provider: Photon primary + Nominatim fallback.** Don't drop Nominatim — Photon outages happen (e.g., the 502 storm on 2026-05-17 that drove this design). Photon stays primary because Nominatim's public instance is rate-limited to ~1 req/sec and would die under autocomplete load.
16. **Planet & Moon textures are Solar System Scope (INOVE), CC BY 4.0 — attribution required.** Files live at `client/public/textures/planets/{mercury,venus,mars,jupiter,saturn,uranus,neptune,moon}.jpg`, sourced from https://www.solarsystemscope.com/textures/. **Implementation requirements:** (a) credit "Planet & Moon textures: Solar System Scope · CC BY 4.0" in AttributionFooter, (b) full credit + license link on the future `/about` page, (c) `_credits.json` next to the textures documenting source per-file. Same legal pattern as the ESO panorama in guardrail #11.
17. **DSO ingest must use SIMBAD TAP with LEFT JOIN allfluxes — not `add_votable_fields`.** In astroquery >= 0.4.8 the old `add_votable_fields("flux(V)", "dim", "otype")` API does INNER joins and silently drops every extended object that lacks a V magnitude in SIMBAD (M42, M45, M8, etc — all the diffuse ones). The TAP query in `scripts/ingest_dso.py` exists specifically to handle this; don't "simplify" back to the old API.
18. **DSO magnitudes/sizes have a dual-source fallback model.** SIMBAD doesn't have V magnitudes for diffuse nebulae or angular sizes for some extended objects (M82, M8, NGC 3372), and it returns the *central star* magnitude for planetary nebulae (M27=14, M57=16 — wrong for our "naked-eye visibility" framing). The ingest script's `CURATED` list carries `magnitude_fallback`, `angular_size_fallback_arcmin`, `minor_axis_fallback_arcmin`, and `prefer_reference_magnitude` flags, all sourced from published catalogs (RC3, Harris96, SkyCat, NED-L5, H&W67, Acker92, Burnham). Output JSON includes `magnitude_source` and `angular_size_source` ("SIMBAD" or "reference") for provenance. **Never** silently substitute values without a citation in the script.
19. **Curated DSO `type` always wins over SIMBAD `OTYPE`.** SIMBAD classifies M8 (Lagoon Nebula) and NGC 2070 (Tarantula Nebula) as `open_cluster` because of embedded star clusters (NGC 6530 / cluster cores). Our user-facing identity is `nebula` for both. The ingest script discards SIMBAD's OTYPE and uses `spec["type"]` directly. Don't reintroduce a SIMBAD-OTYPE inference map.
20. **DSOs render as soft glow + bright nucleus — NOT iconographic glyphs.** Tried glyphs (spiral/puff/dots/ring SVG-style icons) on 2026-05-18; they read as UI chips against the immersive sky and broke the "real-looking sky" feel. The current approach (colored soft glow at real angular size + 5px bright nucleus colored by type) is scientifically honest (real galaxies have bright cores, real nebulae have illuminated centers) and doesn't introduce graphic-design elements. Don't re-add type icons.
21. **Constellation figures are Stellarium Western sky culture (CC BY-SA) — attribution + ShareAlike on the data file.** The line topology baked into `server/data/constellations.json` is derived from Stellarium's `western/index.json` (CC BY-SA "data"). The vendored source lives at `server/data/sources/stellarium_western_index.json`. **Implementation requirements:** (a) `constellations.json` carries a `source` block naming Stellarium (figures, CC BY-SA 4.0) + ESA Hipparcos (coords) + IAU (names); (b) `AttributionFooter` credits "Constellation figures: Stellarium · CC BY-SA"; (c) README data-sources table + future `/about` page credit + license link. ShareAlike applies ONLY to the baked data file — it does NOT affect the rest of the codebase. We use NO Stellarium illustrations (Free Art License), stick figures only. Coordinates (Hipparcos) + names (IAU) are not the ShareAlike part. The ingest parser also strips Stellarium per-line style markers (e.g. "thin") — do not treat those tokens as HIP ids.
22. **The sky chart is an INSIDE view: north up, EAST ON THE LEFT.** `projectAltAz` uses `x = -sin(az)`, `y = -cos(az)` (canvas y-down). That is how the sky looks to an observer looking up, and matches planispheres, Stellarium, and every printed sky chart. The opposite sign (east right) is the outside-a-celestial-globe convention and renders every constellation mirror-imaged — the chart shipped that way until the 2026-07-13 accuracy audit caught it. `projectAltAz`, `inverseStereographic.js`, `CardinalLabels`, and the Milky Way fragment shader all share this convention; if you touch one, keep all four consistent. The fragment shader additionally flips `vUv.y` because GL clip space is y-up while the canvas is y-down.
23. **Milky Way shader math is verified against Astropy — don't "simplify" it.** The 2026-07-13 audit found and fixed three stacked errors in `inverseProjection.frag.js` (screen y-flip vs the star layer, an algebraically wrong galactic-longitude formula, and a wrong texture-layout assumption). The corrected pipeline samples the panorama within 0.04°–0.37° of ground truth (residual = of-date vs J2000 precession + simplified LST — invisible on a diffuse backdrop). eso0932a layout, verified against the bulge and LMC/SMC pixel positions: galactic center (l=0) at u=0.5, l increasing LEFTWARD, NGP at image top, texture v=0 = top row (`UNPACK_FLIP_Y_WEBGL` not set). Anchor for any future change: Sgr A* (RA 266.417°, Dec −29.008°) must come out at l≈359.94°, b≈−0.05°.
24. **Observation-time parsing goes through `app/services/time_utils.parse_utc_time`.** It is the single place a `datetime` query param becomes an Astropy `Time`: accepts Z-suffix, `±HH:MM` offsets, and naive-UTC strings; raises `InvalidObservationTimeError`, which every router maps to a 422. Don't reintroduce ad-hoc `.replace("Z", "")` parsing in services. (Note for the Phase 3b plan: it reserves "guardrail #22" for the enrichment rule — that will now land as #25.)

---

## Commands

### Frontend
```bash
cd client
npm install
npm run dev          # Vite dev server
npm run build        # Production build
npm run lint         # ESLint
```

### Backend
```bash
cd server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python scripts/ingest_gaia.py   # One-time: download Gaia DR3 subset (~80MB)
uvicorn app.main:app --reload --port 8000
pytest                          # Run tests
```

### Full stack (once docker-compose is set up in Phase 4)
```bash
docker-compose up
```

---

## Owner Context

- Developer: Andrew Robalino Garcia (CS major, FIU)
- Primary goals: portfolio piece for space/tech roles, learn real computational astronomy, ship something public
- Communication preference: direct, technical, senior-dev-level feedback. No sugarcoating, no hand-holding. Call out design and code issues honestly.
- Frontend quality matters — aesthetics are a feature, not an afterthought.
- Accuracy matters more — this project exists to prove computational astronomy chops to aerospace employers.
