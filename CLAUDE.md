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
- **Canvas 2D** for sky chart rendering (Phase 2b); **Three.js** deferred to Phase 4 Explore Mode
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

### Tier 2 — Enrichment APIs (cold path, lazy, cached)

Activated progressively across phases. Each lives in its own module under `server/app/services/enrichment/`.

| Source | Provides | Institution | When |
|---|---|---|---|
| **SIMBAD** (CDS) | Canonical object metadata — alternate names, spectral class, object type | CDS Strasbourg | Phase 3 — click-to-lookup on any star |
| **NASA Exoplanet Archive** | Confirmed exoplanets + host stars (~5,600 planets) | **NASA/IPAC** | Phase 3 — overlay "has exoplanets" badge on host stars |
| **JPL Horizons** | Live ephemerides for small bodies (asteroids, comets, spacecraft) | **NASA JPL** | Phase 4 — presets like "Tonight's visible asteroids" |

### Attribution rules
- The `/about` page lists every source with institution name, dataset version, and link to the original.
- Every API response object includes a `source` field (e.g., `"Gaia DR3"`, `"JPL DE421 via Astropy"`, `"SIMBAD/CDS"`).
- Every UI info card displays a source badge.
- Persistent footer: *"Powered by ESA Gaia DR3 · NASA JPL · IAU · CDS SIMBAD · NASA Exoplanet Archive"*

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
- [ ] **Phase 2b** — 2D Sky Chart: Canvas 2D stereographic projection inside the hero placeholder
- [ ] **Phase 3** — Constellations + Enrichment: IAU overlays, SIMBAD + NASA Exoplanet Archive
- [ ] **Phase 4** — Explore Mode: Three.js 3D flyable celestial sphere (behind the "Explore in 3D" button)
- [ ] **Phase 5** — Polish + Deploy: landing, about, docker-compose, live URL

**Rendering pivot:** Three.js is no longer the Phase 2 engine. Canvas 2D ships first in Phase 2b. Three.js is deferred to Phase 4 as a differentiated 3D flythrough. See `SKYVAULT_ROADMAP.md` for the rationale (will be rewritten in Task H2 of the Phase 2a plan).

See `SKYVAULT_ROADMAP.md` for full phase breakdowns and task lists.

---

## Resume Here — Next Session

**Paused:** 2026-04-10, Phase 2a complete (Parts A–H shipped).

**Current state:** Phase 1 + Phase 2a are complete. The full frontend foundation is live on `feat/phase-2a-backend`:
- Backend: `/api/v1/sky` (Gaia DR3), `/api/v1/planets` (JPL DE421 + Moon phase), `/api/v1/geocode` (Photon proxy) — 52 backend tests passing
- Frontend: Vite + React 18 + Tailwind dark shell, Zustand stores, React Query hooks, controls strip with geocoder, info panels (Lunar/Planets/Stars), intro + idle FSMs — 32 frontend tests passing
- Milky Way background asset: **not yet downloaded** — Task H1 requires manually downloading the ESO image (see `docs/superpowers/plans/2026-04-09-phase-2a-frontend-foundation.md` Task H1 for instructions)

**Next up:** Phase 2b — 2D Sky Chart. Canvas 2D stereographic projection inside the hero placeholder. Needs a new spec + plan before execution.

**Rendering pivot:** Three.js is **not** the Phase 2 rendering engine. Canvas 2D ships first in Phase 2b. Three.js is deferred to Phase 4 ("Explore Mode"). See `SKYVAULT_ROADMAP.md` for the full rationale.

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
