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
| **IAU constellation data** | Official 88 constellations, stick figures, boundaries | **IAU** | Static data, committed to repo |
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
│   │   └── constellations.json   # IAU stick figures (committed)
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
Returns IAU constellation stick-figure line segments and label positions. Static. Cached aggressively.

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
- [ ] **Phase 3** — Constellations + Enrichment: IAU overlays, NASA Exoplanet Archive (SIMBAD already integrated for DSOs in 2d)
- [ ] **Phase 4** — Explore Mode: Three.js 3D flyable celestial sphere (behind the "Explore in 3D" button)
- [ ] **Phase 5** — Polish + Deploy: landing, about, docker-compose, live URL

**Rendering pivot:** Three.js is no longer the Phase 2 engine. Canvas 2D ships first in Phase 2b. Three.js is deferred to Phase 4 as a differentiated 3D flythrough. See `SKYVAULT_ROADMAP.md` for the rationale (will be rewritten in Task H2 of the Phase 2a plan).

See `SKYVAULT_ROADMAP.md` for full phase breakdowns and task lists.

---

## Resume Here — Next Session

**Paused:** 2026-05-29, after merging Phase 2d.

**Current state:** Phase 1 + 2a + 2b + 2c + **2d all shipped to main** (PR #2 merged 2026-05-29, commit `f17dccb`). Frontend 169 tests / backend 74 tests, all green; lint clean (0 warnings); production build 236 KB JS (75 KB gzip). Andrew did a live visual-QA pass across the reference observers — holds up; no fixes flagged.

### Next up — Phase 3 (Constellations + Enrichment)

Needs a spec + plan (brainstorm first). Scope:
1. **IAU constellation overlays** — stick figures + (optional) boundaries. `GET /api/v1/constellations` is already in the contract; `constellations.json` (IAU stick figures) needs sourcing/committing. Render as a toggleable line layer in SkyCanvas.
2. **Click-to-lookup SIMBAD on stars** — SIMBAD is already wired (used by DSO ingest), but not yet for interactive star lookups. Add `GET /api/v1/objects/{id}` enrichment path (cached) + frontend click → info panel with alternate names, spectral class, object type.
3. **NASA Exoplanet Archive overlay** — "has confirmed exoplanets" badge on host stars. Cold-path, cached service under `server/app/services/enrichment/exoplanet_archive.py`.

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
