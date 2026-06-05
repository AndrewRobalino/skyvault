# Phase 3b — Star Enrichment (SIMBAD names + NASA Exoplanet hosts)

**Date:** 2026-06-05
**Status:** Design approved, ready for implementation plan
**Depends on:** Phase 3a merged (or branched from it); existing star render path (`/api/v1/sky`), tooltip interaction model, and the proven ingest pattern (DSO catalog, constellation catalog).

---

## Goal

Make every rendered star *identifiable* and surface known planetary systems. Clicking a star resolves its real name (Vega, not `Gaia DR3 4357…`), spectral type, and whether it hosts confirmed exoplanets — all from real institutional sources (CDS SIMBAD, NASA Exoplanet Archive), attributed in the UI.

This is the first enrichment feature. It builds on the existing click-selection model (`selectedId`, hit-test, `SkyTooltip`, `SelectionRing`, ESC) — it is an additive fetch + tooltip extension, **not** new interaction plumbing.

---

## Locked decisions

1. **Both features this phase, SIMBAD-naming first as the foundation, exoplanet hosts layered on.**
2. **Enrichment appears by expanding the existing tooltip** (not a separate side panel). Approved layout:
   ```
   ┌─────────────────────────┐
   │ VEGA                     │
   │ α Lyrae · HD 172167      │
   │ ───────────────────────  │
   │ Magnitude        0.03    │
   │ Spectral type    A0V     │
   │ Distance      25.0 ly    │
   │ ───────────────────────  │
   │ ✦ No known planets       │
   │ Source: Gaia DR3·SIMBAD  │
   └─────────────────────────┘
   ```
3. **Exoplanet status is tooltip-only for now** (no on-chart badge — don't crowd the chart). BUT the host data is **baked regardless**, so switching to an on-chart badge later is a pure frontend change with zero backend rework. Fallback path if Andrew wants it.
4. **Architecture = fully baked.** All enrichment is pre-resolved at ingest time and served from an in-memory store. **Zero external calls at runtime.** Rationale: SkyVault renders only naked-eye stars (mag ≤ 6.5, ~9k), a bounded set small enough to fully pre-resolve. Baked = instant tooltips, offline-capable, no live dependency on SIMBAD/NASA uptime on the interactive path. Reuses the exact pattern of the DSO and constellation bakes. The only cost (data is as-of-ingest) is irrelevant: star names/spectral types don't change and exoplanet additions are slow.

---

## Architecture

### Baked artifact: `server/data/star_enrichment.json`

Keyed by Gaia DR3 `source_id` (string — exceeds `Number.MAX_SAFE_INTEGER`, kept as string end-to-end per existing convention). Per-star shape:

```json
{
  "<gaia_dr3_source_id>": {
    "proper_name": "Vega",
    "designation": "α Lyrae",
    "catalog_ids": ["HD 172167", "HIP 91262"],
    "spectral_type": "A0Va",
    "object_type": "Variable Star",
    "planets": { "count": 0, "names": [] },
    "name_source": "SIMBAD/CDS",
    "planet_source": "NASA Exoplanet Archive"
  }
}
```

- Stars that don't resolve get **no entry** (no faked names). Faint/anonymous stars stay Gaia-only.
- Per-field provenance (`name_source`, `planet_source`) so the tooltip can list only the sources that actually contributed.
- A top-level `source` block documents SIMBAD + NASA Exoplanet Archive (institutions, dataset, license), same as `constellations.json`.

### Ingest: `scripts/ingest_star_enrichment.py`

Runs once, offline. Idempotent. Logs resolution rates so we know exactly what coverage shipped.

1. **Load** the baked bright-star Gaia subset (the `source_id` set we render).
2. **SIMBAD TAP batch** — query joining `basic` + `ident`, filtered to our Gaia DR3 source_ids (`ident.id IN ('Gaia DR3 <id>', …)`). Pull:
   - `main_id`, `sp_type`, object type from `basic`.
   - **Proper name** from `ident` identifiers prefixed `NAME ` (IAU-CSN common names, e.g. `NAME Vega`).
   - **Bayer/Flamsteed designation** from `ident` (e.g. `* alf Lyr`) → format Greek letter to Unicode (`α Lyr`) at bake time.
   - **Catalog IDs** (HD, HIP) from `ident`.
   - Same TAP-with-JOIN discipline as the DSO ingest (guardrail #17) — do NOT use `add_votable_fields`.
3. **NASA Exoplanet Archive** — download the confirmed-planets table (`pscomppars`), read the `gaia_id` column (format `Gaia DR3 <id>`), map host → our source_id, aggregate planet `count` + `names` per host. Hosts without a Gaia DR3 ID simply don't match — honest partial coverage (most bright naked-eye hosts do carry one).
4. **Write** `star_enrichment.json` with per-field provenance + `source` block.

**Coverage expectation:** SIMBAD name/spectral resolution on naked-eye stars is very high (these are the catalogued bright stars). Exoplanet hosts are a smaller honest subset (bright stars that host confirmed planets and carry a Gaia DR3 ID — 51 Peg, Fomalhaut, Pollux, etc.).

### Service + endpoint

- **Service** under `server/app/services/enrichment/` — loader for `star_enrichment.json` (settings-based path, env-overridable), `lru_cache`, in-memory dict lookup by source_id. `StarEnrichmentNotFoundError` (catalog file missing) → 503 with actionable remediation, matching `dso_catalog`/`constellation_catalog`.
- **Endpoint** `GET /api/v1/objects/{source_id}` — replaces the stub in `routers/objects.py`. In-memory lookup, returns Pydantic `ObjectEnrichment`. For a source_id with no entry, returns an empty-enrichment shape (frontend treats as "Gaia-only"). No external calls at runtime.
- The `enrichment/simbad.py` and `enrichment/exoplanet_archive.py` modules hold the **ingest-time** query logic (called by the script), not runtime lookups. Runtime reads only the baked file.

---

## Frontend

### Hook: `useObject(sourceId, enabled)`

Mirrors `useSky`/`useDso`. React Query, caches per source_id. `enabled` gated so it fires **only** when a star is selected (clicked) — never on hover, never for planets/DSOs. Re-clicking a star is instant (cache hit), no refetch.

### Wiring: `SkyChart`

On star select, derive the Gaia source_id from `selectedId` (strip the `star:` / id prefix), pass to `useObject`. Everything else (`selectedId`/`hoveredId`, hit-test on `projected.all`, `SelectionRing`, ESC-clear) is untouched. Hover tooltip stays lightweight (Gaia-only).

### Tooltip: `StarBody` extension

- **Header**: swaps from `Gaia DR3 · <id>` to the **proper name** (`VEGA`) with `designation · catalog id` beneath — once enrichment loads. Falls back to the current `Gaia DR3 · <source_id>` header before load or when the star has no name. No layout jump.
- **New rows**: `Spectral type`; an **exoplanet line** — `✦ N confirmed planets` (with names if few) or `✦ No known planets`. Renders only once enrichment resolves; absent for no-entry stars.
- **Source line**: `Gaia DR3 · SIMBAD · NASA Exoplanet Archive`, listing only sources that contributed for that star.
- **Loading**: a subtle one-line shimmer for the enrichment section. Endpoint is in-memory (~10–20ms) so it's effectively instant; shimmer prevents flicker on cold cache / slow link.

---

## Edge cases / error handling

- **No enrichment entry** → tooltip stays Gaia-only (header `Gaia DR3 · <id>`, no spectral/exoplanet rows). Silent, graceful — the common faint-star case.
- **Endpoint 404 / fetch error** → React Query error swallowed in the tooltip; shows Gaia data. Feature degrades to "no enrichment," never breaks the click.
- **Partial enrichment** (name but no spectral type, or vice versa) → each row renders independently; missing fields show `—` or are omitted, never faked.
- **Greek-letter formatting** done at bake time (`alf Lyr` → `α Lyr`); frontend stays dumb.
- **Re-click / cache** → enrichment cached per source_id for the session; ESC clears selection, cache persists.

---

## Attribution (product requirement — guardrails #4, #10)

- Tooltip source line lists SIMBAD + NASA Exoplanet Archive per-star.
- `AttributionFooter` already credits CDS SIMBAD + NASA Exoplanet Archive — verify and keep.
- Baked JSON carries a `source` block.
- README data-sources rows for SIMBAD + Exoplanet Archive already exist (Phase-3-marked) — flip to active.

---

## Testing (TDD — guardrail #5)

**Backend:**
- `ingest_star_enrichment` parsing / cross-match against real reference values: Vega → `A0Va` + correct HD/HIP; 51 Peg → 1 confirmed planet; an anonymous star → no entry.
- Endpoint: known source_id returns enrichment; unknown returns the empty/404 shape; missing catalog file → 503.
- `lru_cache` autouse clear fixture, matching the other catalogs.

**Frontend:**
- `useObject` gating: does not fire on hover, planet, or DSO selection; fires on star select.
- `StarBody` rendering: named star, anonymous fallback, exoplanet-host vs none, partial-field, loading shimmer.
- Mirrors existing `useDso` / `SkyTooltip` test patterns.

---

## Out of scope (explicit)

- On-chart exoplanet badges (data baked, display deferred — fallback path if requested).
- Live SIMBAD / NASA queries at runtime.
- DSO enrichment (DSOs already carry their own baked metadata).
- Click-to-lookup on planets.

---

## Success criteria

1. Clicking a named bright star shows its real proper name, designation, spectral type, and exoplanet status — instantly, from baked data.
2. Clicking a faint anonymous star gracefully shows Gaia-only data (no fake name, no error).
3. Known exoplanet hosts (51 Peg, Fomalhaut, etc.) correctly show their confirmed planet count.
4. Zero external API calls on the runtime path; the feature works with SIMBAD/NASA offline.
5. Every enriched data point is attributed to its source in the tooltip.
6. Ingest logs resolution coverage; no value is faked or approximated.
