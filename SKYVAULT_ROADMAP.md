# SkyVault — Project Roadmap

> Explore the night sky from any place, any moment in time — powered by real NASA, ESA, and IAU data.

---

## Tech Stack

### Frontend
- **React 18** + **Vite** — fast dev, HMR, optimized builds
- **Tailwind CSS** — dark-first UI system
- **Three.js** (via `@react-three/fiber` + `@react-three/drei`) — 3D celestial sphere rendering
- **Zustand** — lightweight state (date/time/location/selected object)
- **React Query (TanStack)** — API data fetching + caching

### Backend
- **Python 3.11+** / **FastAPI** — async API layer
- **Astropy** — astronomical coordinate transforms, ephemeris calculations
- **astroquery** — unified client for Gaia TAP, SIMBAD, NASA Exoplanet Archive, JPL Horizons
- **NumPy** / **Pandas** / **pyarrow** — fast ops on Gaia subset (stored as parquet)
- **pytest** — testing

### DevOps (Phase 4)
- **Docker** — containerized frontend + backend
- **GitHub Actions** — CI/CD pipeline
- **Vercel** (frontend) + **Railway or Fly.io** (backend)

---

## Data Sources

All real institutional datasets. Two-tier architecture: bulk render data loaded in memory, enrichment data fetched lazily and cached.

### Tier 1 — Bulk (hot path)

| Source | Institution | Provides | Access |
|---|---|---|---|
| **Gaia DR3** (G<8 subset, ~230k stars) | **ESA** | ICRS positions, magnitude, parallax, proper motion, BP-RP color | One-time TAP query via astroquery → parquet |
| **JPL DE421** | **NASA/JPL** | Sun, Moon, Mercury–Neptune positions (arcsecond precision) | Astropy `solar_system_ephemeris.set('de421')` |
| **IAU Constellation Data** | **IAU** | Official 88 constellation boundaries + stick figures | Static JSON committed to repo |

### Tier 2 — Enrichment (cold path, cached)

| Source | Institution | Provides | Activated |
|---|---|---|---|
| **SIMBAD** | CDS Strasbourg | Canonical object names, spectral class, object type | Phase 3 |
| **NASA Exoplanet Archive** | **NASA/IPAC** | ~5,600 confirmed exoplanets + host stars | Phase 3 |
| **JPL Horizons** | **NASA/JPL** | Live ephemerides for asteroids, comets, spacecraft | Phase 4 |

Footer attribution: *"Powered by ESA Gaia DR3 · NASA JPL · IAU · CDS SIMBAD · NASA Exoplanet Archive"*

---

## Phase 1 — Foundation

**Goal:** Backend serves accurate star + planet positions for a given date/time/location, backed by real Gaia and JPL data.

### Backend
- [ ] FastAPI project scaffold (`/api/v1/`)
- [ ] `scripts/ingest_gaia.py` — one-time Gaia DR3 TAP download (G<8, ~230k stars), saves to `server/data/gaia_dr3_g8.parquet`
- [ ] Load Gaia subset into memory on startup (pandas + pyarrow)
- [ ] **`GET /sky`** endpoint:
  - Params: `lat`, `lon`, `datetime` (ISO 8601)
  - Returns: visible stars above horizon with proper motion applied from J2016.0 → observation epoch
  - Fields per star: `id` (Gaia source_id), `name` (if named via cross-match), `ra`, `dec`, `alt`, `az`, `magnitude`, `bp_rp`, `parallax_mas`, `distance_ly`, `source: "Gaia DR3"`
- [ ] Astropy coordinate transform pipeline:
  - Apply Gaia proper motion correction (epoch propagation)
  - Convert ICRS → AltAz for observer's location + time
  - Filter stars below horizon (`alt < 0`)
  - Filter by apparent magnitude (default cap 6.5 for naked-eye, parameterized)
- [ ] **`GET /planets`** endpoint:
  - Same params as `/sky`
  - Returns: Sun, Moon, Mercury–Neptune positions in AltAz
  - Uses `astropy.coordinates.get_body()` with `solar_system_ephemeris.set('de421')`
  - `source: "JPL DE421 via Astropy"`
- [ ] Unit tests — verify known star positions (Sirius, Vega, Polaris) against Stellarium reference values within arcminute accuracy
- [ ] Stub `services/enrichment/` directory with empty module files and TODO markers (Phase 3 activation)

### Frontend
- [ ] Vite + React + Tailwind scaffold
- [ ] Input form: date picker, time picker, location (text input + optional browser geolocation)
- [ ] Basic API integration via React Query — fetch `/sky` and `/planets`, log to console
- [ ] No rendering yet — just confirm data pipeline works end-to-end

### Deliverable
> Hit the API with "Miami, 2026-04-06, 21:00" and get back accurate star + planet positions sourced from Gaia DR3 and JPL DE421. Verified against Stellarium.

---

## Phase 2a — Frontend Foundation

**Goal:** Ship a full interactive shell around the existing Phase 1 APIs with a cinematic dark galactic theme, place-name search, styled info panels, and an intro animation / idle-aware chrome state machine — **without** a sky chart. This is the frontend skeleton that Phase 2b drops a canvas into.

**In scope:**
- Vite + React 18 + Tailwind scaffold under `client/`
- Zustand (`observerStore`, `uiStateStore`) + React Query hooks (`useGeocode`, `useSky`, `usePlanets`)
- Photon (OSM) geocoder proxied via a new `GET /api/v1/geocode?q=` backend route
- Moon-phase extensions to `/api/v1/planets` (phase name, illumination, phase angle)
- Layout shell: fixed Milky Way background (ESO/S. Brunier CC-BY), bordered frame with gold corner brackets, header, footer
- Controls strip: location search with "Did you mean?" dropdown, "Use my location", date/time, UTC/Local toggle, submit
- Hero region: dynamic eyebrow + title ("The sky above <place>"), placeholder for Phase 2b sky chart, stubbed "Explore in 3D" button
- Info panels: Lunar (with inline phase-accurate SVG), Planets (struck-through below-horizon), Stars (top 30 by magnitude with BP-RP color dots)
- Intro FSM: galaxy fade → content fade → hand-off to idle FSM (sessionStorage-gated, `?replay` override, `prefers-reduced-motion` honored)
- Idle FSM: normal → glass (15s) → hidden (5s more), focused-input immunity
- Frontend unit + component tests (Vitest + RTL)

**Out of scope (explicitly Phase 2b):**
- The 2D sky chart itself (Canvas 2D stereographic projection)
- Star click handling, tooltips, hover states on celestial objects

---

## Phase 2b — 2D Sky Chart (Canvas 2D) ✅ COMPLETE

> **Shipped:** rectangular full-bleed stereographic projection, star rendering with magnitude/color-calibrated glow, planet rendering with distinct amber markers, Moon with illumination shadow, cardinal labels, hover + click-to-tooltip progressive disclosure, viewport-capped sizing. See `docs/superpowers/specs/2026-04-13-phase-2b-sky-chart-design.md` and `docs/superpowers/plans/2026-04-13-phase-2b-sky-chart.md`.

**Goal:** Render the actual night sky inside the hero placeholder from Phase 2a using an HTML Canvas 2D stereographic projection.

**In scope:**
- Canvas-based stereographic sky projection centered on zenith
- Star rendering: size from magnitude, color from BP-RP, subtle halo/glow for brightest
- Planet rendering: larger markers with labels
- Cardinal direction labels (N/S/E/W)
- Horizon circle
- Hover/click interaction → selects an object and shows its info panel
- Smooth re-draws on observer change (debounced)

**Out of scope:**
- Zooming / panning (deferred)
- Constellation stick figures (Phase 3)
- 3D flying camera (Phase 4)

---

## Phase 3 — Constellations + Enrichment

**Goal:** IAU constellation stick figures overlayed on the Canvas 2D sky, plus click-to-enrich any star with SIMBAD + NASA Exoplanet Archive data.

- `/api/v1/constellations` — IAU stick-figure line segments
- `/api/v1/objects/{id}` — SIMBAD lookup + exoplanet archive cross-match, server-side cached
- Info-panel tabs for "Catalog data" (Gaia) and "Enrichment" (SIMBAD / NASA)
- Constellation-name labels drawn on the Canvas 2D chart

---

## Phase 4 — Explore Mode (Three.js 3D)

**Goal:** The stubbed "EXPLORE IN 3D" button from Phase 2a routes to an immersive full-window Three.js experience — a flyable celestial sphere where you can drift around, orbit specific stars, and fly to Mars or Jupiter using real JPL Horizons small-body data.

- React Three Fiber + drei
- Full-window canvas (no frame, no chrome — the explore mode owns the screen)
- Real star distances (from Gaia parallax) used for meaningful 3D placement
- Free-cam controls + object-focus camera transitions
- Preset tours: "Tonight's visible asteroids" (JPL Horizons), "Nearest stars", "Bright exoplanet hosts"

---

## Phase 5 — Polish + Deploy

- Landing page, about page with all source attributions
- `/docker-compose.yml` production build
- Live URL (Vercel frontend + Fly.io/Railway backend or equivalent)
- README screenshots, short demo video

---

## Future (v2 — Post-Launch)
- Deep sky objects (Messier catalog — nebulae, galaxies, clusters) via SIMBAD
- Gaia DR3 deeper magnitude subset (G<10, ~2M stars) with frustum culling + LOD
- ISS + satellite pass predictions (Celestrak TLE data)
- Light pollution overlay (Bortle scale by location)
- Shareable links ("See the sky from Paris on your birthday")
- Time-lapse mode — animate the sky rotating over hours
- ML star/constellation recognition from phone camera photos

---

## Key Technical Decisions

1. **Why Gaia DR3 over HYG?** — Gaia DR3 is the modern gold standard for stellar astrometry (ESA, published 2022). HYG is a hobby compilation derived from older catalogs. Gaia gives us better positional accuracy, real parallax distances, and a recognizable institutional name for the `/about` page. Cost: ~1 day extra in Phase 1 for the TAP ingest script.

2. **Why G<8 subset (~230k stars)?** — Matches naked-eye + binocular visibility. Keeps data in-memory friendly (~80MB parquet). Deeper subsets possible post-launch with LOD rendering.

3. **Rendering decision — Canvas 2D for v1, Three.js deferred to Phase 4.** Original plan was Three.js from day one. Reversed after scoping Phase 2a: Canvas 2D can render ≤5000 stars comfortably, ships faster, and the realistic v1 experience is "beautiful 2D sky chart + rich info panels + place-name search." Three.js moves to Phase 4 Explore Mode as the differentiated "wow" experience (flyable 3D universe), rather than the default rendering path.

4. **Why Astropy on the backend instead of in-browser JS?** — Astropy's ephemeris calculations are battle-tested and accurate to arcsecond precision. No JS library comes close. The tradeoff is an API call, but star data for a single sky view is ~50-100KB — fast enough.

5. **Why two-tier data architecture?** — Bulk render data (stars, planets) must be instant, so it lives in memory. Enrichment data (SIMBAD, Exoplanet Archive, Horizons) is click-driven, rate-limited, and must be cached. Mixing them would be an architectural smell.

6. **Why Zustand over Redux?** — Tiny state surface (date, time, lat, lon, selected object, UI toggles). Redux is overkill. Zustand is ~1KB and zero boilerplate.
