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

## Phase 2 — Star Map Rendering

**Goal:** Interactive 3D star field rendered from real Gaia data.

### Frontend — Three.js Scene
- [ ] Celestial sphere setup via `@react-three/fiber`
  - Camera at center (observer), stars plotted on sphere interior
  - AltAz → Three.js coordinates mapping
- [ ] Star rendering:
  - Point cloud geometry (InstancedMesh or Points)
  - Size mapped to apparent magnitude (brighter = larger)
  - Color mapped to BP-RP color index → realistic star colors (blue-white → yellow → orange → red)
  - Fade dimmer stars for realism
- [ ] Camera controls:
  - OrbitControls — drag to look around the sky
  - Scroll to zoom (wide field → narrow field)
  - Smooth damping
- [ ] Planet rendering:
  - Slightly larger points or small sprites with labels
  - Distinct from stars visually
- [ ] Ground plane or horizon line — subtle visual anchor
- [ ] Dark immersive background — no harsh UI chrome on the viewport

### Deliverable
> Enter a date/location → see a realistic, interactive 3D star field you can rotate and zoom. Stars are real Gaia DR3 data, colors are real, planets are real.

---

## Phase 3 — Constellations + Object Info (Enrichment activation)

**Goal:** Constellations overlaid, clicking any object shows real data from multiple NASA/ESA/IAU sources.

### Backend
- [ ] **`GET /constellations`** endpoint:
  - Returns IAU constellation stick-figure line segments
  - Each segment: `[star_source_id_1, star_source_id_2]`
  - Includes constellation label position (centroid)
- [ ] **`GET /objects/{id}`** — enrichment endpoint:
  - `services/enrichment/simbad.py` — query SIMBAD via astroquery for object metadata (alternate names, spectral class, object type)
  - `services/enrichment/exoplanet_archive.py` — lookup in NASA Exoplanet Archive, flag exoplanet hosts with planet count + names
  - Combine Gaia data + SIMBAD + Exoplanet Archive into unified response
  - LRU cache on service methods, in-memory TTL
  - Every field includes its `source`

### Frontend — Constellations
- [ ] Render constellation lines (Three.js Line segments, subtle white/blue, low opacity)
- [ ] Toggle: constellations on/off
- [ ] Constellation labels — HTML overlays or sprite text at centroids
- [ ] Hover effect — highlight full constellation when hovering any member star

### Frontend — Info Cards
- [ ] Click/tap any star → slide-in info panel:
  - Common name + designation (e.g., "Sirius — α Canis Majoris") — from SIMBAD
  - Apparent magnitude, BP-RP color — from Gaia DR3
  - Distance (light-years, from Gaia parallax)
  - Spectral class + object type — from SIMBAD
  - Constellation membership — from IAU
  - Exoplanet host badge + planet count (if applicable) — from NASA Exoplanet Archive
  - **Data source badges**: `"Position: Gaia DR3"`, `"Metadata: SIMBAD/CDS"`, `"Exoplanets: NASA Exoplanet Archive"`
- [ ] Click/tap any planet → similar panel:
  - Current AltAz coordinates, distance from Earth
  - **Data source badge**: `"Ephemeris: NASA JPL DE421 via Astropy"`

### Deliverable
> Full interactive sky with constellations. Click Sirius, get Gaia position + SIMBAD metadata + exoplanet data (if any) with source attribution for each field. Click a Gaia exoplanet host and see "has 3 confirmed exoplanets — NASA Exoplanet Archive".

---

## Phase 4 — Polish, Attribution + Deploy

**Goal:** Production-ready, deployed, portfolio-worthy. JPL Horizons live queries activated.

### Backend — JPL Horizons
- [ ] `services/enrichment/horizons.py` — query JPL Horizons via astroquery for small bodies
- [ ] **`GET /small-bodies`** endpoint — returns currently visible asteroids/comets above magnitude threshold
- [ ] Aggressive caching (Horizons is rate-limited; cache per body per day)

### UI Polish
- [ ] Landing page — dark, cinematic hero with subtle star particle animation
- [ ] Smooth loading state (skeleton → star field fade-in)
- [ ] Responsive — works on tablet + mobile (touch controls for Three.js)
- [ ] Input UX improvements:
  - Location autocomplete (geocoding API or simple city list)
  - "Use my location" button
  - Quick presets: "Tonight", "My birthday", "Apollo 11 launch", "Tonight's visible asteroids" (uses Horizons)
- [ ] Keyboard shortcuts (R to reset view, C to toggle constellations, etc.)

### Data Attribution
- [ ] Persistent footer badge: *"Powered by ESA Gaia DR3 · NASA JPL · IAU · CDS SIMBAD · NASA Exoplanet Archive"*
- [ ] Dedicated `/about` page:
  - Each data source explained in plain language
  - Institution, dataset version, link to original
  - Accuracy notes + methodology (coordinate frames, epoch handling, proper motion)
  - Tech stack overview

### DevOps
- [ ] Dockerize frontend + backend
- [ ] GitHub Actions CI: lint, test on push
- [ ] Deploy frontend → Vercel
- [ ] Deploy backend → Railway or Fly.io
- [ ] Environment config (.env) for API URLs
- [ ] Gaia ingest runs at build time (or checked-in parquet if small enough)

### Deliverable
> Live URL. Share it. It works. It's real. Five real institutional sources attributed on every data point.

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

3. **Why Three.js over D3/Canvas2D?** — A celestial sphere is inherently 3D. Projecting to 2D loses the immersion. Three.js gives us free camera rotation, zoom, and future extensibility (deep sky objects, satellite orbits).

4. **Why Astropy on the backend instead of in-browser JS?** — Astropy's ephemeris calculations are battle-tested and accurate to arcsecond precision. No JS library comes close. The tradeoff is an API call, but star data for a single sky view is ~50-100KB — fast enough.

5. **Why two-tier data architecture?** — Bulk render data (stars, planets) must be instant, so it lives in memory. Enrichment data (SIMBAD, Exoplanet Archive, Horizons) is click-driven, rate-limited, and must be cached. Mixing them would be an architectural smell.

6. **Why Zustand over Redux?** — Tiny state surface (date, time, lat, lon, selected object, UI toggles). Redux is overkill. Zustand is ~1KB and zero boilerplate.
