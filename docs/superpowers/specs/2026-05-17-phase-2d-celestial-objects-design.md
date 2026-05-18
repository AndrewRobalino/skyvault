# Phase 2d — Celestial Objects (design)

**Date:** 2026-05-17
**Author:** Andrew Robalino Garcia
**Status:** Draft — awaiting implementation plan
**Prerequisite:** PR #1 (Phase 2b + 2c) merged to `main`
**Branch:** `feat/phase-2d-celestial-objects` (off `main` after the merge)

---

## Goal

Make every visible body in the sky actually appear and read as what it is. Today the chart shows stars beautifully and renders the Milky Way as a backdrop, but every planet is an undifferentiated yellow dot, the Moon ignores its actual phase, and naked-eye deep-sky objects — Andromeda, the Pleiades, the Orion Nebula, the Magellanic Clouds — are missing entirely.

Phase 2d closes that gap.

## What ships

1. **Sun** — procedural golden disk at real angular size (~30 arcmin), with a soft radial corona glow. No texture (would look bad at small render size and requires HDR).
2. **Moon** — Solar System Scope `2k_moon.jpg` texture drawn at near-real angular size, with a shadow overlay driven by the existing backend `illumination` field. Phase name (already in the API) shown in the info panel. Terminator drawn vertically for v1 — bright-limb position angle is deferred.
3. **Planets** — Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune. Small ~12 px textured icons replace the yellow dots. Click → photoreal full-resolution image displays in the info panel alongside the existing metadata.
4. **Naked-eye DSOs** — ~25 hand-curated objects (Messier + Caldwell + LMC/SMC) rendered as soft elliptical glows at real angular dimensions. Color-hinted by type: pale blue for galaxies, pink/red for emission nebulae, white for open/globular clusters.

## What's deliberately NOT in scope

| Item | Why deferred |
|---|---|
| Bright-limb position angle for Moon terminator | v1 vertical terminator looks fine; PA polish in Phase 3. |
| Saturn's rings as separate tilted sprite with ring-plane angle | Baked into texture is enough; tilt animation = scope creep. |
| DSO click-to-enrich via SIMBAD lookup | Phase 3 (Enrichment). |
| Constellation stick figures + labels | Phase 3. |
| Earth (as a body in any frame) | Not a thing you observe from Earth. |
| Solar corona / chromosphere detail | Sun is rendered procedurally; no real solar imagery. |
| Atmospheric extinction dimming planets/DSOs near horizon | Polish for Phase 5. |

---

## Architecture

### Backend (`server/app/`)

**New files**
- `services/dso_catalog.py` — loads `data/naked_eye_dso.json` once at startup (~5 KB, in memory). Function `dsos_for_observer(lat, lon, time_utc) -> list[DeepSkyObject]` returns objects with computed AltAz, filtered to `alt > 0`.
- `routers/dso.py` — `GET /api/v1/dso?lat&lon&datetime` → `{ "dsos": [...], "count": N, "source": "SIMBAD/CDS" }`.
- `scripts/ingest_dso.py` — one-time script. Queries SIMBAD via `astroquery.simbad` for the curated name list, parses RA/Dec/V-magnitude/major-axis-arcmin/minor-axis-arcmin/position-angle/object-type, writes `server/data/naked_eye_dso.json`. Idempotent; commit the JSON output.

**New schema** (`models/schemas.py`)
```python
class DeepSkyObject(BaseModel):
    id: str                          # "M31", "LMC", "Eta-Carinae-Nebula"
    common_name: str                 # "Andromeda Galaxy"
    messier_id: str | None = None    # "M31" or None
    type: Literal["galaxy", "nebula", "open_cluster", "globular_cluster"]
    ra: float                        # ICRS deg
    dec: float                       # ICRS deg
    alt: float                       # observer AltAz deg
    az: float                        # observer AltAz deg
    magnitude: float                 # V mag
    angular_size_arcmin: float       # major axis
    minor_axis_arcmin: float | None = None
    position_angle_deg: float | None = None
    source: Literal["SIMBAD/CDS"] = "SIMBAD/CDS"
```

**Curated DSO list** (~25 objects, locked in the ingest script):

Northern + general: M31 Andromeda, M33 Triangulum, M42 Orion Nebula, M45 Pleiades, M44 Beehive, M81 Bode's Galaxy, M82 Cigar Galaxy, M51 Whirlpool, M27 Dumbbell, M13 Hercules Cluster, M8 Lagoon Nebula, M57 Ring Nebula, M67 open cluster, M11 Wild Duck.

Southern: LMC, SMC, Omega Centauri (NGC 5139), 47 Tucanae (NGC 104), Eta Carinae Nebula (NGC 3372), Tarantula Nebula (NGC 2070), Jewel Box (NGC 4755), NGC 253 Sculptor Galaxy, Centaurus A (NGC 5128).

Additional bright targets: M3 Canes Venatici globular cluster, M104 Sombrero Galaxy.

Total: 25 objects. Dark nebulae (e.g., Coalsack) are deliberately excluded — they're visible as the *absence* of stars and need a different render technique than soft glows. Defer to Phase 3.

Anything SIMBAD doesn't return clean data for during ingest → log and skip. Don't guess values.

**Endpoints already covering Sun/Moon/planets**
- `GET /api/v1/planets` already returns Sun, Moon, all naked-eye planets with AltAz, distance, and (for Moon) `phase_angle`, `illumination`, `phase_name`. No backend changes for sprites; the frontend reads what's already there.

### Frontend (`client/src/`)

**New renderers** (in `components/hero/`)
- `dsoRenderer.js` — for each DSO returned by `useDso`: project AltAz → canvas xy via the existing stereographic projection, draw a radial-gradient ellipse sized by `angular_size_arcmin` (mapped through the same arcmin-to-pixel function as the chart), rotated by `position_angle_deg` if present. Color by `type` via a small lookup table. Soft additive blend (`globalCompositeOperation = "lighter"`) at low alpha so bright cluster stars in the Pleiades still pop through.
- `planetSpriteRenderer.js` — replaces the current yellow-dot pass. Preloads + caches `HTMLImageElement` per planet (singleton module-level map). Each frame: for each planet, draw the cached image at fixed ~12 px (Saturn slightly larger for ring visibility). Twinkle disabled (planets don't twinkle in real life either). Falls back to a colored dot for one frame while the image is loading — no crash, no blank.
- `moonRenderer.js` — draws moon texture at ~22 px (real angular size at chart scale would be smaller, but this reads better visually — stylized but honest). Then composites a black ellipse on top sized by `1 - illumination` to simulate the shadow. Vertical terminator. Composited with `globalCompositeOperation = "multiply"` so the texture darkens rather than gets covered.
- `sunRenderer.js` — procedural: radial gradient golden disk (~24 px) + outer corona glow falloff. Drawn only when `alt > 0` (i.e., daytime observation).

**New hook**
- `hooks/useDso.js` — React Query fetch, key `["dso", lat, lon, datetimeUtc]`, gated on `selected != null` (same pattern as `useSky`, `usePlanets`). Stale time: `Infinity` per request (sky doesn't change for a fixed observer).

**Render order** (back → front in the main canvas pipeline):
1. Milky Way WebGL backdrop
2. DSO soft glows (under stars so Pleiades' bright stars dominate visually)
3. Stars (Phase 2c renderer untouched)
4. Sun (only if `alt > 0`)
5. Planets
6. Moon
7. Labels

**Info panel additions** (`components/info/`)
- Existing `PlanetInfoCard` gets a new optional `<img>` slot showing the photoreal texture (same file the chart icon samples). Source attribution unchanged ("JPL DE421 via Astropy" remains the *positional* source; texture credit lives in AttributionFooter and `/about`).
- New `DsoInfoCard` for DSOs — displays common name, type, magnitude, angular size, distance if known, `"source": "SIMBAD/CDS"` badge.

### Assets

`client/public/textures/planets/` (new directory):
- `mercury.jpg`, `venus.jpg`, `mars.jpg`, `jupiter.jpg`, `saturn.jpg`, `uranus.jpg`, `neptune.jpg`, `moon.jpg`
- All sourced from Solar System Scope (https://www.solarsystemscope.com/textures/), downscaled locally from 2K to 512 px JPG (we render at ~12-32 px, 2K is wasteful)
- `_credits.json` in the same directory listing source + license per file — keeps the attribution machine-readable for the `/about` page generator

Estimated bundle impact: 9 × ~80 KB ≈ 720 KB. DSO JSON ~5 KB. Within the 1.5 MB acceptance budget.

---

## Asset sourcing & licensing

| Asset | Source | License | Where attributed |
|---|---|---|---|
| Planet textures (Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune) | Solar System Scope (INOVE) — solarsystemscope.com/textures | CC BY 4.0 | AttributionFooter + `/about` + source-file comment in `planetSpriteRenderer.js` |
| Moon texture (`moon.jpg`) | Solar System Scope | CC BY 4.0 | Same as above |
| Sun (procedural) | None | n/a | n/a |
| DSO positions, magnitudes, angular sizes | SIMBAD (CDS Strasbourg) via astroquery | Open scientific use — attribution required per CDS terms | Per-object `source` field in API; AttributionFooter; `/about` |
| Milky Way panorama (unchanged) | ESO / S. Brunier (eso0932a) | CC BY 4.0 | Existing AttributionFooter — no change |

**Attribution footer (new line added):**
> Planet & Moon textures: Solar System Scope · CC BY 4.0

**Modification disclosure (CC BY 4.0):** Drawing a texture onto a sprite is rendering, not modification. No "modified from" flag required. Same logic we applied to the ESO panorama in Phase 2c.

**Per-image credits file** (`client/public/textures/planets/_credits.json`):
```json
{
  "license": "CC BY 4.0",
  "license_url": "https://creativecommons.org/licenses/by/4.0/",
  "source_url": "https://www.solarsystemscope.com/textures/",
  "attribution": "Planet & Moon textures © Solar System Scope (INOVE), CC BY 4.0",
  "files": {
    "mercury.jpg":  { "original": "2k_mercury.jpg" },
    "venus.jpg":    { "original": "2k_venus_atmosphere.jpg" },
    "mars.jpg":     { "original": "2k_mars.jpg" },
    "jupiter.jpg":  { "original": "2k_jupiter.jpg" },
    "saturn.jpg":   { "original": "2k_saturn.jpg" },
    "uranus.jpg":   { "original": "2k_uranus.jpg" },
    "neptune.jpg":  { "original": "2k_neptune.jpg" },
    "moon.jpg":     { "original": "2k_moon.jpg" }
  }
}
```

---

## Testing

### Backend (pytest, real reference values)

- `tests/test_dso_catalog.py` — JSON loads, schema valid, 25 ± curated count, every object has `source: "SIMBAD/CDS"`.
- `tests/test_dso_router.py` — three observer queries:
  - NYC summer (2026-08-15T02:00Z, lat 40.71, lon -74.01): M31 `alt > 0`.
  - Buenos Aires same instant (lat -34.61, lon -58.40): LMC + SMC `alt > 0`.
  - Below-horizon objects filtered out (Eta Carinae from NYC summer must NOT appear).
- `tests/test_dso_ingest.py` — mock SIMBAD response for one object, verify parser produces correct schema. Never hit SIMBAD live in tests.

### Frontend (Vitest + RTL)

- `dsoRenderer.test.js` — canvas draw calls: ellipse drawn at correct AltAz→canvas position, size scaled by `angular_size_arcmin`, color matches `type`, additive blend used.
- `moonRenderer.test.js` — illumination=1.0 → no shadow composite call; illumination=0.0 → full-disk shadow composite; illumination=0.5 → half-disk shadow. Tests inspect compositing calls on the mock canvas, following the Phase 2c star renderer test pattern (offset-validating gradient mock).
- `planetSpriteRenderer.test.js` — image preloaded per planet, cached across frames, fallback dot drawn before image loads, no crash on first frame.
- `useDso.test.js` — fires only when `selected != null`; refetches on observer or datetime change.

### Visual QA (manual, blocking before merge)

Three reference observers, same set as Phase 2c. Now verifying:

1. **Delray FL 2001-08-14 night** (lat 26.46, lon -80.07) — Jupiter and Saturn visible as icons with correct size/color. Moon at correct phase for that date.
2. **NYC summer 2026-08-15T02:00Z** (lat 40.71, lon -74.01) — Andromeda visible mid-sky as a soft oval. Vega/Deneb/Altair still dominate visually.
3. **Buenos Aires same instant** (lat -34.61, lon -58.40) — LMC + SMC visible as soft patches. Pleiades and Eta Carinae visible.
4. **Anchorage winter 2026-12-15T06:00Z** (lat 61.22, lon -149.90) — Pleiades + M42 Orion Nebula prominent. Andromeda still up.

Screenshots required in the PR description.

### Acceptance criteria (merge gates)

- All new tests green; full suite still green (target: 133 + N frontend, 55 + N backend).
- Three-observer visual QA done with screenshots in PR.
- Attribution updated in AttributionFooter + `_credits.json` present.
- No regression in Phase 2c star rendering (Stellarium-style point look preserved).
- Frontend bundle stays under 1.5 MB.

---

## Risks & open questions

| Risk | Mitigation |
|---|---|
| SIMBAD ingest returns inconsistent angular sizes for a few objects | Log and skip during ingest. Don't guess. Curated list shrinks slightly if needed. |
| Planet icons at 12 px look muddy from 512 px JPG | Acceptable tradeoff vs bundle bloat. If muddy, drop to 256 px or use canvas `imageSmoothingQuality = "high"`. |
| Moon shadow with vertical terminator is technically wrong (real PA varies) | Documented as deferred. Visual QA confirms it still reads as "the right phase". |
| Bundle growth pushes initial load slow | Lazy-load textures (load on first render of that planet) if budget tight. |
| Additive blending of DSO glows over Milky Way backdrop looks washed out | Tune alpha during visual QA. Worst case, change to source-over with lower opacity. |

---

## Out of session

- Andrew needs to merge PR #1 (Phase 2b + 2c) into `main` before this branch is cut.
- Solar System Scope assets must be downloaded and committed by Andrew (or as part of the implementation plan's first task).
