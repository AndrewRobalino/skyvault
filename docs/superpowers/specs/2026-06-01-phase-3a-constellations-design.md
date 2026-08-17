# Phase 3a — Constellations (Design)

**Date:** 2026-06-01
**Status:** Approved (brainstorm), pending implementation plan
**Phase:** 3a (Phase 3 split into 3a Constellations + 3b Enrichment)

## Summary

Add a toggleable constellation-figure overlay to the sky chart: stick-figure
lines connecting stars plus constellation name labels. The overlay is observer-
parameterized — segments and labels are computed for the current location/time
on the backend (ICRS→AltAz via Astropy) and projected on the frontend exactly
like stars. No boundaries, no artwork, no interaction. This is a pure additive
visual layer.

This is the first half of Phase 3. The second half (3b — click-to-lookup SIMBAD
on stars + NASA Exoplanet Archive host-star badges) is a separate spec→plan→PR
cycle and is explicitly out of scope here.

## Goals

- Render the 88 Western constellation stick figures as faint connective lines.
- Show constellation name labels at figure centroids.
- Only draw what is above the horizon for the current observer (per-segment and
  per-label visibility), consistent with how stars are filtered.
- Keep it opt-in and immersive-friendly: a toggle, OFF by default.
- Maintain scientific honesty and full source attribution.

## Non-Goals (out of scope for 3a)

- IAU constellation **boundaries** (borders). Stick figures only.
- The Stellarium **illustrations/artwork** (Free Art License). We use line
  topology + names only.
- **Click-to-lookup / SIMBAD on stars** — Phase 3b.
- **NASA Exoplanet Archive** host-star badges — Phase 3b.
- **Horizon-crossing segment clipping** — YAGNI. Segments with exactly one
  endpoint below the horizon are dropped, not clipped.
- Any change to the existing click/hover/ESC selection or tooltip model.

## Data Source & Licensing

Constellation figures come from the **Stellarium Western sky culture**
(`stellarium-skycultures` repo, `western/index.json`). Stellarium dropped the
old `constellationship.fab` format; the modern source is `index.json`.

Triple attribution:
- **Stellarium Western sky culture** — line topology (which stars connect).
  License: **CC BY-SA**. This is the curated/creative part we copy.
- **ESA Hipparcos** — J2000 RA/Dec for each HIP star (scientific data, free;
  attribution courtesy). Resolved at ingest time via astroquery VizieR.
- **IAU** — constellation names/abbreviations (public).

### CC BY-SA / ShareAlike handling

The baked `constellations.json` is a derivative of CC BY-SA data, so **that file**
must carry a CC BY-SA notice. ShareAlike applies to the adapted data work only —
it does **not** spread to the rest of the SkyVault codebase. Concretely:

1. `constellations.json` includes a top-level `source`/`license` block naming all
   three sources and stating `CC BY-SA 4.0` for the figure data.
2. `AttributionFooter` adds: `Constellation figures: Stellarium · CC BY-SA`.
3. README data-sources table + future `/about` page: full credit + links to the
   sky culture and the CC BY-SA license.
4. A new CLAUDE.md guardrail codifies this obligation.

We use **no illustrations** from Stellarium, so the Free Art License never enters
the repo.

### `index.json` data shape (input)

```json
{ "id": "CON western Aql",
  "lines": [[98036, 97649, 97278], [97649, 95501, 97804], ...],
  "common_name": {"english": "Eagle", "native": "Aquila"},
  "iau": "Aql" }
```

`lines` are **polylines of HIP IDs** — connect consecutive entries within each
inner array. e.g. `[98036, 97649, 97278]` → segments (98036→97649),
(97649→97278). A constellation has multiple polylines.

## Architecture

All coordinate transforms stay in Astropy on the backend. The frontend only
projects alt/az → screen, same as stars. The current `/constellations` no-arg
static stub is replaced with an observer-parameterized endpoint.

### Backend

**`scripts/ingest_constellations.py`** (mirrors `ingest_dso.py` / `ingest_gaia.py`)
- Read `western/index.json` (committed source copy or documented download step).
- Parse each constellation's `lines` polylines → flatten into consecutive HIP
  pairs. Build the unique HIP set across all constellations.
- Resolve every HIP → J2000 RA/Dec via astroquery VizieR (Hipparcos catalog).
- Warn + skip any HIP that fails to resolve (don't abort the whole bake).
- Write `server/data/constellations.json`. Idempotent.
- Tests run against a small fixture, not live VizieR.

**`server/data/constellations.json`** (committed, baked output) schema:
```json
{
  "source": {
    "figures": "Stellarium Western sky culture",
    "figures_license": "CC BY-SA 4.0",
    "coordinates": "ESA Hipparcos (VizieR)",
    "names": "IAU"
  },
  "constellations": [
    {
      "id": "Aql",                       // IAU abbreviation
      "name": "Eagle",                   // English common name
      "segments": [
        { "from": [ra, dec], "to": [ra, dec] }, ...
      ],
      "label": [ra, dec]                 // centroid of the figure's stars
    }
  ]
}
```

**`server/app/services/constellation_catalog.py`** (new)
- Load `constellations.json`, `lru_cache`d (autouse cache-clear fixture in tests,
  same pattern as `dso_catalog.py`).
- `DataNotFoundError` (mirrors `DsoCatalogNotFoundError`) with actionable
  remediation if the file is missing.
- Dedupe segment endpoints, build a single vectorized `SkyCoord` (ICRS) →
  transform to AltAz for the observer's `EarthLocation` + `Time`.
- A segment is `visible` only when **both** endpoints are above the horizon.
  Drop (don't clip) horizon-crossing segments.
- A label is `visible` only when its centroid is above the horizon.
- `constellations_for_observer(lat, lon, time_utc)` returns per-constellation
  segments with alt/az for both endpoints + visible flags, and the label with
  alt/az + visible flag.

**Router rewrite** — `GET /api/v1/constellations?lat&lon&datetime`
- Same observer params as `/sky` and `/planets`.
- Thin handler; business logic in the service.
- Pydantic schemas: `ConstellationSegment`, `Constellation`,
  `ConstellationsResponse`. Include the `source` block in the response.

### Frontend

**`uiStateStore`** — add `showConstellations: boolean` (default **false**) +
`toggleConstellations()` / `setShowConstellations()`. Visual chrome, orthogonal
to `observerStore`.

**`useConstellations(lat, lon, datetimeUtc)`** hook (new, in `hooks/`)
- React Query, mirrors `useSky`/`useDso` shape.
- **Gated**: `enabled: showConstellations` — no fetch when the layer is off.

**`api.constellations`** — fetch wrapper mirroring `api.sky` / `api.dso`.

**Projection** — a `projectConstellations` util attaches screen coords to each
visible segment endpoint and each visible label centroid, using the same
alt/az → screen projection as stars. Segments/labels already filtered to
visible by the backend; the projector skips anything flagged not visible.

**`SkyCanvas`** — draw constellation lines in layer order:
`backdrop → constellation lines → DSOs → stars → planets`. Lines sit *behind*
objects so stars/planets stay on top and clickable.
- Style: faint blue-white `rgba(150, 180, 220, ~0.22)`, 1px (1.5px on retina).
- **No glow / no additive blend** (avoids the blobbing issue in guardrail #12).
- Only draw when `showConstellations` is true.

**`ConstellationLabels.jsx`** (new) — DOM overlay, same pattern as
`PlanetLabels` / `CardinalLabels`. Absolutely positioned, `pointer-events-none`,
`aria-hidden`. Placed at each visible label's projected centroid. Dimmer +
smaller than planet labels, uppercase with wide letter-spacing. Rendered only
when `showConstellations` is true.

**Toggle control** — placed with the existing chrome view controls.

### Interaction

Lines and labels are **non-interactive** in 3a: `pointer-events-none`, no
hit-testing, no tooltips. The existing `selectedId`/`hoveredId` selection model,
`SkyTooltip`, `SelectionRing`, and ESC handling are untouched. This makes 3a a
pure additive overlay with zero risk to the working selection plumbing.

## Data Flow

1. User toggles constellations ON (`showConstellations = true`).
2. `useConstellations` (now enabled) fetches
   `/api/v1/constellations?lat&lon&datetime` using the current observer state.
3. Backend loads baked `constellations.json`, runs all endpoints + centroids
   through ICRS→AltAz for the observer, flags visibility, returns segments +
   labels with alt/az.
4. Frontend `projectConstellations` projects visible alt/az → screen.
5. `SkyCanvas` draws visible segments behind objects; `ConstellationLabels`
   renders visible centroids as DOM labels.
6. On observer change (new GO / time change), the gated query refetches like
   `useSky`/`useDso`.

## Error Handling

- Missing `constellations.json` → `DataNotFoundError` with remediation pointing
  at `ingest_constellations.py` (same pattern as `DsoCatalogNotFoundError`).
- HIP resolution failures at ingest → warn + skip that star/segment, continue.
- Frontend query error → layer simply doesn't render (no crash); existing error
  surfaces are unchanged. Stars/planets/DSOs are independent queries.

## Testing

### Backend (TDD, real reference values)
- `ingest_constellations.py`: polyline → consecutive HIP-pair flattening; HIP
  dedupe; warn+skip on missing HIP. Against a small fixture, not live VizieR.
- `constellation_catalog.py`: load + `lru_cache`; vectorized ICRS→AltAz; segment
  `visible` only when both endpoints up; centroid label visibility. Verify a
  known figure (e.g. Orion's belt) lands at the expected alt/az for a known
  observer + time, arcminute tolerance (same bar as star tests).
- Router: `?lat&lon&datetime` contract; `DataNotFoundError` path when the data
  file is missing; `source` block present in the response.

### Frontend
- `useConstellations` gated-query behavior (no fetch when toggle off).
- `projectConstellations` segment + label placement and horizon filtering.
- `ConstellationLabels` placement / horizon filtering / not rendered when off.
- Toggle flips `showConstellations`; canvas draws lines only when on.
- Layer-order assertion (lines drawn before stars/planets).

## Attribution Checklist

- [ ] `constellations.json` `source`/`license` block (CC BY-SA 4.0 on figures).
- [ ] `AttributionFooter`: `Constellation figures: Stellarium · CC BY-SA`.
- [ ] README data-sources table entry + links.
- [ ] `/about` page full credit (Phase 5 — note the obligation now).
- [ ] New CLAUDE.md guardrail for the CC BY-SA ShareAlike obligation.

## Open Questions

None. License resolved (CC BY-SA, figures only), source format confirmed
(`index.json`), frontend + backend design approved in brainstorm.
