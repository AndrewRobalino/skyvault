# Bright Star Supplement — Design Spec

**Date:** 2026-08-17
**Status:** Approved, pending implementation plan
**Branch:** `feat/bright-stars` (stacked on `feat/phase-3b-enrichment`, PR #5)

---

## Problem

SkyVault does not render any of the bright stars.

`server/data/gaia_dr3_g9.parquet` contains 177,426 sources, but its brightest is **G = 1.732**. There are **zero** stars brighter than that, only 7 brighter than G = 2, and 150 brighter than G = 3 — far below the real sky. The following naked-eye stars are absent from the chart entirely:

> Sirius, Canopus, Arcturus, Vega, Capella, Rigel, Procyon, Achernar, Betelgeuse, Altair, Aldebaran, Antares, Spica, Pollux, Fomalhaut, Deneb, Regulus

This is **not an ingest filter bug**. `scripts/ingest_gaia.py` queries `phot_g_mean_mag IS NOT NULL AND phot_g_mean_mag < 9.0` — no lower bound. The gap is Gaia DR3's own bright-end incompleteness: the instrument saturates on the brightest sources, so they are either absent from the catalogue or carry no usable `phot_g_mean_mag`.

The defect was latent from Phase 1 and only surfaced during Phase 3b, whose headline feature is clicking a star to see its proper name — while the stars that *have* proper names are precisely the missing ones. Only 226 of 12,037 enriched stars carry a proper name.

For a project whose stated purpose is proving computational-astronomy competence to aerospace employers, a sky chart missing every star a person can actually name is a credibility failure. An astronomer would notice immediately.

## Goal

Every naked-eye star is rendered, with correct position, brightness, and color, and each star's data provenance is stated honestly.

**Non-goals.** No change to the projection, the rendering style, or the Phase 4/5 roadmap. No re-ingest of the Gaia catalogue. No new UI surface.

---

## Decisions (locked)

### 1. Merge strategy — union with exact dedupe, Gaia wins per star

Ingest the Hipparcos naked-eye set, cross-match it to Gaia through SIMBAD's exact `HIP ↔ Gaia DR3` identifier mapping, and keep the Gaia row wherever one exists. Hipparcos contributes **only** stars Gaia genuinely lacks.

Rejected alternatives:

- **Threshold splice** (Hipparcos above magnitude *T*, Gaia below). Requires guessing a completeness boundary, and because G and V differ per star by 0.1–0.5 mag depending on color, stars near the seam can duplicate or vanish.
- **Hipparcos owns the whole naked-eye set.** Simplest story, but discards Gaia's far superior astrometry for ~12,000 stars and undercuts the project's Gaia DR3 framing.

The chosen approach needs no magnitude boundary at all, and every star ends up with the best astrometry available for it.

### 2. Identity — `hip:` prefix for Hipparcos-only stars

Hipparcos-supplied stars carry `source_id = "hip:<HIP>"` (e.g. `hip:91262`). The 12,119 existing Gaia ids stay bare numeric.

Purely additive: no migration of existing ids, no regeneration of the 3.26 MB baked enrichment catalog, no change to existing frontend id strings. Provenance is readable from the id itself. `star_enrichment.enrichment_for` already tolerates arbitrary string keys (it rejects only `__`-prefixed reserved keys).

Colons are legal in URL path segments (RFC 3986), so `GET /api/v1/objects/hip:91262` needs no encoding.

### 3. Color — derive BP−RP from B−V via a published relation

Hipparcos supplies Johnson **B−V**; the renderer colors stars from Gaia **BP−RP**. Bright stars are exactly the ones whose color is most recognizable (Betelgeuse red, Rigel blue), so leaving them colorless is the worst outcome.

Convert at ingest using the published Gaia DR3 photometric relationship, keeping one color pipeline. Every derived value is marked with a `color_source` field and the relation is cited.

Permitted under guardrail #3, which allows published reference values with citation.

### 4. Magnitude — derive G from V by the companion relation

The `magnitude` field means Gaia G, and the renderer sizes stars from it. Mixing Johnson V into the same field would render bright stars at subtly wrong sizes and make the `mag_limit` filter mean two different things at once.

Apply the companion **G−V** relation from the same published source, store the derived G in `magnitude`, and mark it with `magnitude_source`.

### 5. Coefficients are looked up, never invented

The polynomial coefficients come from the Gaia DR3 photometric relations (Riello et al. 2021, *Gaia EDR3 photometric content and validation*). They must be **verified against the published table at implementation time** and cited in the ingest script, the README data-source row, and the parquet's provenance block.

No coefficient may be written from memory. If the published relation cannot be retrieved, implementation stops and asks — inventing a transformation would be exactly the kind of plausible-looking wrong data this project exists not to produce.

---

## Architecture

### Ingest — `server/scripts/ingest_bright_stars.py`

Follows the established ingest pattern (fetch all, filter locally, bake, commit; the request path never touches VizieR or SIMBAD).

1. **Fetch Hipparcos.** VizieR `I/239/hip_main`, columns `HIP, RAICRS, DEICRS, Vmag, B-V, Plx, pmRA, pmDE`, filtered locally to **V ≤ 7.0**. Mirrors `ingest_constellations.py`, which already uses this catalogue and fetch-all-then-filter approach.

   The 7.0 cut is a deliberate margin, not the render limit. G and V differ by up to ~0.5 mag depending on color, so filtering the *source* at V ≤ 6.5 would silently drop red stars whose derived G lands inside the naked-eye set. The parquet therefore holds a superset and `query_visible_stars()` applies the real `mag_limit` cut on derived G at request time — exactly how `gaia_dr3_g9.parquet` stores G < 9 and is filtered to 6.5 at runtime.
2. **Resolve HIP → Gaia DR3.** One chunked SIMBAD TAP query over the `ident` table, returning exact identifier pairs. Subject to the same 10,000-row cap discipline as `fetch_simbad` — chunk sizes must keep every query under the cap, and the query must raise if a result comes back at it.
3. **Dedupe.** Drop each Hipparcos star whose mapped Gaia source_id is present in `gaia_dr3_g9.parquet`.
4. **Transform.** Derive `bp_rp` from B−V and `magnitude` from V + B−V using the cited relations. Compute `distance_ly` from `Plx`; a non-positive or missing parallax yields `None` rather than a fabricated distance.
5. **Write** `server/data/bright_stars.parquet` (committed) with a provenance block naming ESA Hipparcos (van Leeuwen 2007 reduction), the photometric relation, and the ingest date.

### Serving — `server/app/services/star_catalog.py`

`get_catalog()` loads both parquets and concatenates them **once** at first access. The merge happens at load, so `query_visible_stars()` remains a single in-memory magnitude filter and the render hot path is unchanged.

If `bright_stars.parquet` is missing, raise the same actionable error style as `CatalogNotIngestedError`, naming the script to run.

### Epoch handling — `server/app/services/coordinates.py`

**The load-bearing change.** `coordinates.py` currently applies a module-level `GAIA_REFERENCE_EPOCH = Time("J2016.0")` to every star. Hipparcos positions are epoch **J1991.25**. Propagating them from the Gaia epoch would apply ~25 years of proper motion in the wrong direction — visibly wrong for high-proper-motion stars.

The merged frame gains an `epoch` column (`J2016.0` for Gaia rows, `J1991.25` for Hipparcos rows), and `apply_space_motion` is driven by per-star epochs instead of the global constant.

`GAIA_REFERENCE_EPOCH` remains as the Gaia default rather than being deleted, so existing behavior for Gaia rows is provably unchanged.

### Schema — `server/app/models/schemas.py`

`Star` gains two optional provenance fields:

- `color_source: str | None` — absent for Gaia rows; for Hipparcos rows, names the derivation and its citation.
- `magnitude_source: str | None` — same treatment.

`source` already exists on `Star` and carries `"Gaia DR3"` or `"ESA Hipparcos"` per star.

### Enrichment — `server/scripts/ingest_star_enrichment.py`

The `hip:` stars are the ones that actually have proper names, so they must be enriched or the whole point is lost.

The ingest gains a second resolution path querying SIMBAD by `HIP <id>` rather than `Gaia DR3 <id>`, writing `hip:`-keyed entries into the same `star_enrichment.json`. Identical row-cap discipline. The existing Gaia-keyed entries are untouched.

### Attribution

ESA Hipparcos is already credited for constellation coordinates. Extend to cover star positions:

- `AttributionFooter` — bright-star line.
- `README.md` — Hipparcos row updated to cover both uses; new row for the photometric relation.
- `CLAUDE.md` — Tier 1 data-source table, plus a new guardrail covering the epoch rule and the derived-photometry rule.

---

## Acceptance gate — `server/scripts/verify_bright_stars.py`

A committed verification script in the spirit of `verify_backdrop_projection.py`, exiting non-zero on failure.

It asserts that a canonical list of ~20 stars — Sirius, Canopus, Arcturus, Vega, Capella, Rigel, Procyon, Achernar, Betelgeuse, Altair, Aldebaran, Antares, Spica, Pollux, Fomalhaut, Deneb, Regulus, Castor, Bellatrix, Polaris — is **present in the merged catalog**, and that each position agrees with published ICRS coordinates within **1 arcsecond**.

This is the highest-value artifact in the change. The same check would have caught both the missing bright stars and the SIMBAD row-cap truncation immediately, rather than months later. It runs in CI-style fashion after any change to the ingest or merge path.

---

## Testing

- **Ingest pure helpers** (TDD, network-free): B−V → BP−RP and V → G transforms against published worked values; dedupe logic against fixtures; parallax → distance including the non-positive-parallax case.
- **Catalog merge**: fixture parquets covering a Gaia-only star, a Hipparcos-only star, and a star present in both (asserting Gaia wins and the row appears exactly once).
- **Epoch correctness**: a high-proper-motion star pinned at both epochs, asserting a Hipparcos row is propagated from J1991.25 and a Gaia row from J2016.0, with the Gaia path unchanged from current behavior.
- **Schema**: `color_source` / `magnitude_source` serialize and default to `None`.
- **Frontend**: a `hip:`-prefixed `source_id` round-trips through projection, hit-testing, selection, and the enrichment tooltip.
- **Live network tests** (`network` mark, deselected by default) for the VizieR and SIMBAD fetches.

## Risks

| Risk | Mitigation |
|---|---|
| Published coefficients unavailable or ambiguous | Stop and ask. Never invent a transformation. |
| SIMBAD HIP↔Gaia mapping incomplete for some stars | Those stars are simply added as `hip:` rows — the failure mode is a duplicate, caught by the acceptance gate's presence-and-position check. |
| Duplicate stars surviving dedupe | Acceptance gate plus a merge test asserting each canonical star appears exactly once. |
| Epoch change regresses Gaia rendering | Gaia path keeps its existing constant and is pinned by tests written before the change. |
| Derived photometry drifts from Gaia's scale | Values marked with provenance fields and surfaced in the tooltip source line; never presented as measured. |

## Success criteria

1. Every star in the acceptance list renders, positioned within 1 arcsec of published ICRS.
2. No star appears twice.
3. Gaia rows are byte-for-byte unchanged in behavior.
4. Bright stars carry correct color and size, with derived values marked.
5. Clicking Vega shows "Vega" with its spectral type.
6. Backend and frontend suites green; `verify_backdrop_projection.py` still passes.
