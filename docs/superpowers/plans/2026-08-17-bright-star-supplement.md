# Bright Star Supplement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every naked-eye star renders — including Sirius, Vega, Betelgeuse and the rest of the bright sky that Gaia DR3 is missing — with correct position, size, color, and honest provenance.

**Architecture:** Ingest the Hipparcos naked-eye set from VizieR, cross-match it to Gaia through SIMBAD's exact `HIP ↔ Gaia DR3` identifier mapping, and keep only the stars Gaia genuinely lacks. Bake them to a second parquet that uses Gaia's own column names, concatenated into the in-memory catalog once at load. Positions carry a per-star reference epoch because Hipparcos is J1991.25 and Gaia is J2016.0.

**Tech Stack:** Python 3.11+, astroquery (Vizier + Simbad TAP), pandas/pyarrow, FastAPI, Astropy, pytest.

**Spec:** `docs/superpowers/specs/2026-08-17-bright-star-supplement-design.md`

## Global Constraints

- **Never invent photometric coefficients.** The two polynomials in Task 1 are transcribed from the Gaia EDR3 documentation, Table 5.7 (Riello et al. 2021, *Gaia EDR3 photometric content and validation*), fetched from `https://gea.esac.esa.int/archive/documentation/GEDR3/Data_processing/chap_cu5pho/cu5pho_sec_photSystem/cu5pho_ssec_photRelations.html`. If a value in this plan disagrees with that table, the table wins — stop and ask.
- **Derived values are always marked.** Any star whose magnitude or color came from a transformation carries `magnitude_source` / `color_source` naming the relation. Never present derived photometry as measured (guardrail #3).
- **SIMBAD TAP truncates silently at 10,000 rows.** Every TAP query in this plan must keep its result under that cap and raise if it comes back at it. See guardrail #25.
- **The request path makes zero external calls.** VizieR and SIMBAD are ingest-time only; output is committed.
- **Gaia rows must be behaviourally unchanged.** Any test that passes before this change passes after it.
- Existing state at the start of this plan: backend **128** default tests + **3** network, frontend **193**, all green.

---

## File Structure

**Create:**
- `server/scripts/ingest_bright_stars.py` — pure photometric/dedupe helpers + live fetch glue + `main()`.
- `server/scripts/verify_bright_stars.py` — acceptance gate; exits non-zero if a canonical star is missing or mispositioned.
- `server/data/bright_stars.parquet` — baked artifact (committed).
- `server/tests/test_bright_stars_ingest.py` — pure-helper tests.
- `server/tests/test_star_catalog_merge.py` — merge/dedupe tests.
- `server/tests/fixtures/bright_stars_minimal.parquet` — 3-row fixture (built by a test helper, not committed binary-by-hand).

**Modify:**
- `server/app/config.py` — add `bright_stars_parquet_path`.
- `server/app/models/schemas.py` — `Star` gains `color_source`, `magnitude_source`.
- `server/app/services/star_catalog.py` — load + concatenate both parquets.
- `server/app/services/coordinates.py` — per-star reference epoch.
- `server/app/routers/sky.py` — pass the new provenance fields through.
- `server/scripts/ingest_star_enrichment.py` — resolve `hip:` stars by HIP id.
- `client/src/components/hero/AttributionFooter.jsx`, `README.md`, `CLAUDE.md` — attribution + guardrail.

---

### Task 1: Photometric transforms (pure, TDD)

**Files:**
- Create: `server/scripts/ingest_bright_stars.py`
- Test: `server/tests/test_bright_stars_ingest.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `gaia_g_from_v_bv(v: float, b_v: float | None) -> float | None`, `bp_rp_from_v_i(v_i: float | None) -> float | None`, constants `G_V_COEFFS`, `BP_RP_COEFFS`, `B_V_VALID`, `V_I_VALID`, `MAGNITUDE_SOURCE`, `COLOR_SOURCE`.

- [ ] **Step 1: Write the failing test**

Create `server/tests/test_bright_stars_ingest.py`:

```python
import pytest

from scripts.ingest_bright_stars import (
    bp_rp_from_v_i,
    gaia_g_from_v_bv,
)


def test_g_from_v_bv_at_zero_color():
    # G - V = c0 when B-V = 0, so G = V + c0 = 5.0 + (-0.04749)
    assert gaia_g_from_v_bv(5.0, 0.0) == pytest.approx(4.95251, abs=1e-5)


def test_g_from_v_bv_at_unit_color():
    # G - V = -0.04749 - 0.0124 - 0.2901 + 0.02008 = -0.32991
    assert gaia_g_from_v_bv(5.0, 1.0) == pytest.approx(4.67009, abs=1e-5)


def test_g_from_v_bv_is_always_brighter_than_v_for_red_stars():
    # Gaia's G band is broad and red-sensitive: a red star is brighter in G.
    assert gaia_g_from_v_bv(2.0, 1.5) < 2.0


def test_g_from_v_bv_returns_none_outside_valid_color_range():
    # Table 5.7 states the relation holds for -0.4 < B-V < 3.3.
    assert gaia_g_from_v_bv(5.0, 4.0) is None
    assert gaia_g_from_v_bv(5.0, -1.0) is None


def test_g_from_v_bv_returns_none_without_color():
    assert gaia_g_from_v_bv(5.0, None) is None


def test_bp_rp_at_zero_color():
    assert bp_rp_from_v_i(0.0) == pytest.approx(-0.03298, abs=1e-5)


def test_bp_rp_at_unit_color():
    # -0.03298 + 1.259 - 0.1279 + 0.01631 = 1.11443
    assert bp_rp_from_v_i(1.0) == pytest.approx(1.11443, abs=1e-5)


def test_bp_rp_increases_with_v_i():
    assert bp_rp_from_v_i(0.5) < bp_rp_from_v_i(1.5)


def test_bp_rp_returns_none_outside_valid_range():
    # Table 5.7 states the relation holds for -0.4 < V-I < 5.0.
    assert bp_rp_from_v_i(6.0) is None
    assert bp_rp_from_v_i(-1.0) is None


def test_bp_rp_returns_none_without_color():
    assert bp_rp_from_v_i(None) is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && .venv\Scripts\python -m pytest tests/test_bright_stars_ingest.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'scripts.ingest_bright_stars'`.

- [ ] **Step 3: Implement the transforms**

Create `server/scripts/ingest_bright_stars.py`:

```python
"""One-time ingest: supplement the Gaia DR3 catalog with the bright stars it lacks.

Gaia DR3 saturates on the brightest sources — ``gaia_dr3_g9.parquet`` bottoms out
at G = 1.73, so Sirius, Vega, Betelgeuse and every other famous star are missing
from the chart entirely. This script fetches the Hipparcos naked-eye set, drops
everything Gaia already has, and bakes the remainder to a second parquet.

The request path never hits VizieR or SIMBAD — output is committed.

Usage:
    cd server
    python scripts/ingest_bright_stars.py
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# Hipparcos positions are on the ICRS at this epoch. Gaia DR3 is J2016.0.
# Mixing them up propagates ~25 years of proper motion the wrong way.
HIPPARCOS_EPOCH = "J1991.25"

STAR_SOURCE = "ESA Hipparcos"

# --- Photometric relations -------------------------------------------------
# Gaia EDR3 documentation, Table 5.7 "Photometric relationships with other
# photometric systems" (Riello et al. 2021). Transcribed, never derived here:
#   https://gea.esac.esa.int/archive/documentation/GEDR3/Data_processing/
#   chap_cu5pho/cu5pho_sec_photSystem/cu5pho_ssec_photRelations.html
#
# G - V   = c0 + c1(B-V) + c2(B-V)^2 + c3(B-V)^3      sigma = 0.04772 mag
# BP - RP = c0 + c1(V-I) + c2(V-I)^2 + c3(V-I)^3      sigma = 0.04459 mag
G_V_COEFFS = (-0.04749, -0.0124, -0.2901, 0.02008)
BP_RP_COEFFS = (-0.03298, 1.259, -0.1279, 0.01631)

# Validity ranges quoted alongside the relations. Outside them the polynomials
# are extrapolation, not measurement, so we return None instead of a number.
B_V_VALID = (-0.4, 3.3)
V_I_VALID = (-0.4, 5.0)

MAGNITUDE_SOURCE = (
    "Derived from Hipparcos V and B-V via the Gaia EDR3 G-V relation "
    "(Riello et al. 2021, Table 5.7)"
)
COLOR_SOURCE = (
    "Derived from Hipparcos V-I via the Gaia EDR3 BP-RP relation "
    "(Riello et al. 2021, Table 5.7)"
)


def _poly(coeffs: tuple[float, ...], x: float) -> float:
    return sum(c * x**i for i, c in enumerate(coeffs))


def _in_range(value: float, bounds: tuple[float, float]) -> bool:
    low, high = bounds
    return low < value < high


def gaia_g_from_v_bv(v: float, b_v: float | None) -> float | None:
    """Convert Johnson V + (B-V) to an approximate Gaia G magnitude.

    Returns None when the color is missing or outside the relation's validity
    range — the renderer sizes stars from this value, so a wrong number is worse
    than no number.
    """
    if b_v is None or v is None:
        return None
    if not _in_range(b_v, B_V_VALID):
        return None
    return v + _poly(G_V_COEFFS, b_v)


def bp_rp_from_v_i(v_i: float | None) -> float | None:
    """Convert Johnson-Cousins (V-I) to an approximate Gaia BP-RP color."""
    if v_i is None:
        return None
    if not _in_range(v_i, V_I_VALID):
        return None
    return _poly(BP_RP_COEFFS, v_i)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && .venv\Scripts\python -m pytest tests/test_bright_stars_ingest.py -q`
Expected: PASS (10 passed).

- [ ] **Step 5: Commit**

```bash
git add server/scripts/ingest_bright_stars.py server/tests/test_bright_stars_ingest.py
git commit -m "feat(bright-stars): cited Gaia photometric transforms"
```

---

### Task 2: Row building and dedupe (pure, TDD)

**Files:**
- Modify: `server/scripts/ingest_bright_stars.py`
- Test: `server/tests/test_bright_stars_ingest.py`

**Interfaces:**
- Consumes: `gaia_g_from_v_bv`, `bp_rp_from_v_i`, `HIPPARCOS_EPOCH`, `STAR_SOURCE`, `MAGNITUDE_SOURCE`, `COLOR_SOURCE` from Task 1.
- Produces: `hip_source_id(hip: int) -> str`, `build_star_row(rec: dict) -> dict | None`, `select_missing(hip_records: list[dict], hip_to_gaia: dict[str, str], gaia_ids: set[str]) -> list[dict]`.

- [ ] **Step 1: Write the failing test**

Append to `server/tests/test_bright_stars_ingest.py`:

```python
from scripts.ingest_bright_stars import (
    build_star_row,
    hip_source_id,
    select_missing,
)


def test_hip_source_id_is_prefixed():
    assert hip_source_id(91262) == "hip:91262"


def test_build_star_row_maps_to_gaia_column_names():
    row = build_star_row(
        {"HIP": 91262, "RAICRS": 279.234, "DEICRS": 38.783, "Vmag": 0.03,
         "B-V": 0.0, "V-I": 0.0, "Plx": 130.23, "pmRA": 200.94, "pmDE": 286.23}
    )
    # coordinates.py consumes ra/dec/pmra/pmdec/parallax by these exact names.
    assert row["source_id"] == "hip:91262"
    assert row["ra"] == pytest.approx(279.234)
    assert row["dec"] == pytest.approx(38.783)
    assert row["pmra"] == pytest.approx(200.94)
    assert row["pmdec"] == pytest.approx(286.23)
    assert row["parallax"] == pytest.approx(130.23)
    assert row["epoch"] == "J1991.25"
    assert row["source"] == "ESA Hipparcos"


def test_build_star_row_derives_photometry_with_provenance():
    row = build_star_row(
        {"HIP": 1, "RAICRS": 0.0, "DEICRS": 0.0, "Vmag": 5.0,
         "B-V": 0.0, "V-I": 0.0, "Plx": 10.0, "pmRA": 0.0, "pmDE": 0.0}
    )
    assert row["phot_g_mean_mag"] == pytest.approx(4.95251, abs=1e-5)
    assert row["bp_rp"] == pytest.approx(-0.03298, abs=1e-5)
    assert "Riello" in row["magnitude_source"]
    assert "Riello" in row["color_source"]


def test_build_star_row_rejects_star_without_derivable_magnitude():
    # No B-V means no G, and the renderer sizes stars by G. Drop it rather than
    # invent a magnitude.
    row = build_star_row(
        {"HIP": 2, "RAICRS": 0.0, "DEICRS": 0.0, "Vmag": 5.0,
         "B-V": None, "V-I": 0.5, "Plx": 10.0, "pmRA": 0.0, "pmDE": 0.0}
    )
    assert row is None


def test_build_star_row_allows_missing_color():
    # Color is optional — the renderer has a neutral fallback. Magnitude is not.
    row = build_star_row(
        {"HIP": 3, "RAICRS": 0.0, "DEICRS": 0.0, "Vmag": 5.0,
         "B-V": 0.5, "V-I": None, "Plx": 10.0, "pmRA": 0.0, "pmDE": 0.0}
    )
    assert row is not None
    assert row["bp_rp"] is None
    assert row["color_source"] is None


def test_select_missing_drops_stars_gaia_already_has():
    records = [
        {"HIP": 100, "RAICRS": 1.0, "DEICRS": 1.0, "Vmag": 2.0, "B-V": 0.0,
         "V-I": 0.0, "Plx": 10.0, "pmRA": 0.0, "pmDE": 0.0},
        {"HIP": 200, "RAICRS": 2.0, "DEICRS": 2.0, "Vmag": 2.0, "B-V": 0.0,
         "V-I": 0.0, "Plx": 10.0, "pmRA": 0.0, "pmDE": 0.0},
    ]
    hip_to_gaia = {"100": "555000000000000000"}   # HIP 100 is in Gaia
    gaia_ids = {"555000000000000000"}

    kept = select_missing(records, hip_to_gaia, gaia_ids)

    assert [r["source_id"] for r in kept] == ["hip:200"]


def test_select_missing_keeps_star_whose_gaia_id_is_outside_our_subset():
    # SIMBAD knows a Gaia id, but that source is not in our G<9 parquet
    # (bright stars often have null phot_g_mean_mag) — so we still need it.
    records = [
        {"HIP": 300, "RAICRS": 3.0, "DEICRS": 3.0, "Vmag": 1.0, "B-V": 0.0,
         "V-I": 0.0, "Plx": 10.0, "pmRA": 0.0, "pmDE": 0.0},
    ]
    kept = select_missing(records, {"300": "999000000000000000"}, set())
    assert [r["source_id"] for r in kept] == ["hip:300"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && .venv\Scripts\python -m pytest tests/test_bright_stars_ingest.py -q`
Expected: FAIL — `ImportError: cannot import name 'build_star_row'`.

- [ ] **Step 3: Implement**

Append to `server/scripts/ingest_bright_stars.py`:

```python
def hip_source_id(hip: int) -> str:
    """Namespaced id for a Hipparcos-supplied star (spec decision 2)."""
    return f"hip:{int(hip)}"


def _opt_float(value: object) -> float | None:
    """VizieR gives masked cells; normalise them to None."""
    if value is None:
        return None
    try:
        out = float(value)
    except (TypeError, ValueError):
        return None
    return None if out != out else out  # NaN check


def build_star_row(rec: dict) -> dict | None:
    """Map one Hipparcos record onto the Gaia column names the pipeline expects.

    Returns None when no magnitude can be derived — the renderer sizes stars by
    magnitude, so dropping the star is honest and inventing one is not.
    """
    v = _opt_float(rec.get("Vmag"))
    b_v = _opt_float(rec.get("B-V"))
    v_i = _opt_float(rec.get("V-I"))
    if v is None:
        return None

    g = gaia_g_from_v_bv(v, b_v)
    if g is None:
        return None

    bp_rp = bp_rp_from_v_i(v_i)

    return {
        "source_id": hip_source_id(rec["HIP"]),
        "ra": _opt_float(rec.get("RAICRS")),
        "dec": _opt_float(rec.get("DEICRS")),
        "pmra": _opt_float(rec.get("pmRA")),
        "pmdec": _opt_float(rec.get("pmDE")),
        "parallax": _opt_float(rec.get("Plx")),
        "phot_g_mean_mag": g,
        "bp_rp": bp_rp,
        "epoch": HIPPARCOS_EPOCH,
        "source": STAR_SOURCE,
        "magnitude_source": MAGNITUDE_SOURCE,
        "color_source": COLOR_SOURCE if bp_rp is not None else None,
    }


def select_missing(
    hip_records: list[dict],
    hip_to_gaia: dict[str, str],
    gaia_ids: set[str],
) -> list[dict]:
    """Keep only Hipparcos stars that are not already in the Gaia catalog.

    ``hip_to_gaia`` is SIMBAD's exact identifier cross-match; ``gaia_ids`` is the
    set of source_ids actually present in our parquet. A star is dropped only
    when both agree it is already rendered — Gaia's astrometry wins.
    """
    kept: list[dict] = []
    for rec in hip_records:
        gaia_id = hip_to_gaia.get(str(rec["HIP"]))
        if gaia_id is not None and gaia_id in gaia_ids:
            continue
        row = build_star_row(rec)
        if row is not None:
            kept.append(row)
    return kept
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && .venv\Scripts\python -m pytest tests/test_bright_stars_ingest.py -q`
Expected: PASS (17 passed).

- [ ] **Step 5: Commit**

```bash
git add server/scripts/ingest_bright_stars.py server/tests/test_bright_stars_ingest.py
git commit -m "feat(bright-stars): row mapping + exact Gaia dedupe"
```

---

### Task 3: Live fetch glue + bake the parquet

**Files:**
- Modify: `server/scripts/ingest_bright_stars.py`
- Modify: `server/app/config.py`
- Create: `server/data/bright_stars.parquet` (generated, committed)

**Interfaces:**
- Consumes: `select_missing` from Task 2.
- Produces: `fetch_hipparcos(mag_limit: float) -> list[dict]`, `fetch_hip_to_gaia(hips: list[str], chunk_size: int) -> dict[str, str]`, `main()`, and `settings.bright_stars_parquet_path`.

- [ ] **Step 1: Add the config path**

In `server/app/config.py`, directly after the `gaia_parquet_path` line:

```python
    # Bright-star supplement — the stars Gaia DR3 saturates on
    # (produced once via scripts/ingest_bright_stars.py)
    bright_stars_parquet_path: Path = DATA_DIR / "bright_stars.parquet"
```

- [ ] **Step 2: Implement the fetchers and main()**

Append to `server/scripts/ingest_bright_stars.py`:

```python
# VizieR returns a restricted default column set for this catalogue; V-I only
# appears when explicitly requested. Verified against I/239/hip_main.
HIP_COLUMNS = ["HIP", "RAICRS", "DEICRS", "Vmag", "B-V", "V-I", "Plx", "pmRA", "pmDE"]

# The Hipparcos cut is deliberately looser than the render limit. G and V differ
# by up to ~0.5 mag with color, so cutting the source at 6.5 would silently drop
# red stars whose derived G lands inside the naked-eye set. query_visible_stars()
# applies the real mag_limit on derived G at request time.
HIP_FETCH_MAG_LIMIT = 7.0

# SIMBAD TAP truncates silently at this many rows (guardrail #25).
TAP_ROW_CAP = 10_000


def fetch_hipparcos(mag_limit: float = HIP_FETCH_MAG_LIMIT) -> list[dict]:
    """Fetch the Hipparcos naked-eye set from VizieR I/239/hip_main.

    Fetch-all-then-filter, mirroring ingest_constellations.py — more robust than
    per-id queries and only slightly more data.
    """
    from astroquery.vizier import Vizier

    v = Vizier(columns=HIP_COLUMNS, row_limit=-1)
    table = v.get_catalogs("I/239/hip_main")[0]
    logger.info("Hipparcos rows fetched: %d", len(table))

    records: list[dict] = []
    for row in table:
        vmag = _opt_float(row["Vmag"])
        if vmag is None or vmag > mag_limit:
            continue
        records.append({col: row[col] for col in HIP_COLUMNS})
    logger.info("Hipparcos rows at V <= %.1f: %d", mag_limit, len(records))
    return records


def fetch_hip_to_gaia(hips: list[str], chunk_size: int = 3000) -> dict[str, str]:
    """Exact HIP -> Gaia DR3 source_id map from SIMBAD's ident table.

    Two rows per matched star (the HIP id and the Gaia id share an oid), so the
    fan-out is small and chunk_size can be large — but the TAP row cap still
    applies and is checked explicitly.
    """
    from astroquery.simbad import Simbad

    out: dict[str, str] = {}
    for start in range(0, len(hips), chunk_size):
        chunk = hips[start : start + chunk_size]
        id_list = ", ".join(f"'HIP {h}'" for h in chunk)
        query = f"""
            SELECT hip.id AS hip_id, gaia.id AS gaia_id
            FROM ident AS hip
            JOIN ident AS gaia ON gaia.oidref = hip.oidref
            WHERE hip.id IN ({id_list})
              AND gaia.id LIKE 'Gaia DR3 %'
        """
        table = Simbad.query_tap(query)
        if len(table) >= TAP_ROW_CAP:
            raise RuntimeError(
                f"SIMBAD returned {len(table)} rows for a {len(chunk)}-star "
                f"chunk, at or above the {TAP_ROW_CAP}-row TAP cap — the result "
                f"is truncated. Lower chunk_size."
            )
        for row in table:
            hip = str(row["hip_id"]).replace("HIP ", "").strip()
            gaia = str(row["gaia_id"]).replace("Gaia DR3 ", "").strip()
            out[hip] = gaia
        logger.info("HIP->Gaia resolved %d/%d so far", len(out), start + len(chunk))
    return out


def _log_photometry_residuals(records, hip_to_gaia, gaia_df) -> None:
    """Measure the G transform against real Gaia photometry.

    Stars present in BOTH catalogs are discarded by the dedupe, but before that
    they are the only place we can check the transcribed coefficients against
    measured data. Derived G should sit within the relation's quoted scatter
    (sigma = 0.04772 mag) of Gaia's own G. A large residual means the
    coefficients are wrong or mis-transcribed — stop and re-check Table 5.7.
    """
    measured = dict(zip(gaia_df["source_id"], gaia_df["phot_g_mean_mag"]))

    residuals: list[float] = []
    for rec in records:
        gaia_id = hip_to_gaia.get(str(rec["HIP"]))
        if gaia_id is None or gaia_id not in measured:
            continue
        derived = gaia_g_from_v_bv(_opt_float(rec.get("Vmag")), _opt_float(rec.get("B-V")))
        actual = _opt_float(measured[gaia_id])
        if derived is None or actual is None:
            continue
        residuals.append(derived - actual)

    if not residuals:
        logger.warning("Photometry check: no overlapping stars to compare")
        return

    n = len(residuals)
    mean = sum(residuals) / n
    rms = (sum(r * r for r in residuals) / n) ** 0.5
    logger.info(
        "Photometry check on %d overlapping stars: mean %+.4f, RMS %.4f mag "
        "(relation sigma = 0.04772)",
        n, mean, rms,
    )
    if rms > 0.25:
        raise RuntimeError(
            f"Derived G disagrees with measured Gaia G by RMS {rms:.4f} mag, far "
            f"beyond the relation's 0.04772 scatter. The photometric coefficients "
            f"are likely wrong — re-check Gaia EDR3 Table 5.7 before baking."
        )


def main() -> None:
    import pandas as pd

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    from app.config import settings

    records = fetch_hipparcos()
    hips = [str(r["HIP"]) for r in records]

    hip_to_gaia = fetch_hip_to_gaia(hips)
    logger.info("HIP->Gaia cross-matches: %d/%d", len(hip_to_gaia), len(hips))

    gaia_df = pd.read_parquet(
        settings.gaia_parquet_path, columns=["source_id", "phot_g_mean_mag"]
    )
    gaia_df["source_id"] = gaia_df["source_id"].astype(str)
    gaia_ids = set(gaia_df["source_id"])
    logger.info("Gaia source_ids in catalog: %d", len(gaia_ids))

    _log_photometry_residuals(records, hip_to_gaia, gaia_df)

    rows = select_missing(records, hip_to_gaia, gaia_ids)
    logger.info("Bright stars Gaia lacks: %d", len(rows))

    df = pd.DataFrame(rows)
    out_path = settings.bright_stars_parquet_path
    df.to_parquet(out_path, engine="pyarrow", index=False)
    logger.info("Wrote %s (%d rows)", out_path, len(df))


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run the bake (network required)**

Run: `cd server && .venv\Scripts\python scripts/ingest_bright_stars.py`

Expected: logs the Hipparcos row count, the HIP→Gaia cross-match count, and a "Bright stars Gaia lacks" count. Writes `server/data/bright_stars.parquet`.

Sanity floor: the count of added stars must be **at least 15**, because we know from the spec that at least Sirius, Canopus, Arcturus, Vega, Capella, Rigel, Procyon, Achernar, Betelgeuse, Altair, Aldebaran, Antares, Spica, Pollux, Fomalhaut, Deneb and Regulus are missing. If it comes back near zero, the dedupe is wrong — stop and investigate rather than committing the file.

> **If this environment has no network:** commit Steps 1–2 and hand the bake to Andrew, exactly as the Gaia/DSO/constellation ingests are handled. Tasks 4–6 use fixtures and do not need the real parquet; Task 8 does.

- [ ] **Step 4: Confirm the parquet is committable**

Run: `git check-ignore -v server/data/bright_stars.parquet`

The existing ignore rule is `server/data/gaia_dr3_*.parquet`, which is Gaia-specific, so this file should **not** match. Expected: no output and exit code 1, meaning it is not ignored. If it *does* report a match, add `!server/data/bright_stars.parquet` beside the other negations in `.gitignore`.

Then confirm it actually staged: `git status --short server/data/bright_stars.parquet` must show it.

- [ ] **Step 5: Add network-marked tests for the live fetches**

Append to `server/tests/test_bright_stars_ingest.py`. These are gated behind the
`network` mark and deselected by default (`pytest.ini` sets `-m "not network"`),
matching `test_geocoder_acceptance.py`:

```python
@pytest.mark.network
def test_hipparcos_fetch_returns_the_expected_columns():
    from scripts.ingest_bright_stars import HIP_COLUMNS, fetch_hipparcos

    records = fetch_hipparcos(mag_limit=2.0)
    assert len(records) > 20, "V <= 2.0 should yield dozens of stars"
    assert set(HIP_COLUMNS).issubset(records[0].keys())


@pytest.mark.network
def test_hip_to_gaia_resolves_a_known_star():
    from scripts.ingest_bright_stars import fetch_hip_to_gaia

    # HIP 91262 is Vega. SIMBAD should know its Gaia DR3 counterpart.
    mapping = fetch_hip_to_gaia(["91262"])
    assert "91262" in mapping
    assert mapping["91262"].isdigit()
```

Run: `cd server && .venv\Scripts\python -m pytest -m network -q`
Expected: PASS — the 3 existing geocoder tests plus these 2.

- [ ] **Step 6: Commit**

```bash
git add server/scripts/ingest_bright_stars.py server/app/config.py server/data/bright_stars.parquet server/tests/test_bright_stars_ingest.py
git commit -m "feat(bright-stars): Hipparcos fetch, SIMBAD cross-match, baked parquet"
```

---

### Task 4: Schema provenance fields

**Files:**
- Modify: `server/app/models/schemas.py`
- Modify: `server/app/routers/sky.py`
- Test: `server/tests/test_schemas_enrichment.py` (append; it already covers schema shape)

**Interfaces:**
- Consumes: nothing.
- Produces: `Star.color_source: str | None`, `Star.magnitude_source: str | None`.

- [ ] **Step 1: Write the failing test**

Append to `server/tests/test_schemas_enrichment.py`:

```python
from app.models.schemas import Star


def test_star_provenance_fields_default_to_none():
    star = Star(
        source_id="123", ra=1.0, dec=2.0, alt=3.0, az=4.0, magnitude=5.0
    )
    assert star.color_source is None
    assert star.magnitude_source is None
    assert star.source == "Gaia DR3"


def test_star_carries_derived_photometry_provenance():
    star = Star(
        source_id="hip:91262", ra=1.0, dec=2.0, alt=3.0, az=4.0, magnitude=0.03,
        source="ESA Hipparcos",
        magnitude_source="Derived from Hipparcos V and B-V via the Gaia EDR3 "
                         "G-V relation (Riello et al. 2021, Table 5.7)",
        color_source="Derived from Hipparcos V-I via the Gaia EDR3 BP-RP "
                      "relation (Riello et al. 2021, Table 5.7)",
    )
    assert star.source_id.startswith("hip:")
    assert "Riello" in star.magnitude_source
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && .venv\Scripts\python -m pytest tests/test_schemas_enrichment.py -q`
Expected: FAIL — Pydantic rejects the unknown `color_source` / `magnitude_source` fields.

- [ ] **Step 3: Add the fields**

In `server/app/models/schemas.py`, inside `class Star`, directly after the `source: str = "Gaia DR3"` line:

```python
    # Provenance for values that were transformed rather than measured. Present
    # only on stars supplemented from Hipparcos; None for Gaia rows.
    magnitude_source: str | None = None
    color_source: str | None = None
```

- [ ] **Step 4: Pass them through the router**

In `server/app/routers/sky.py`, find where each `Star(...)` is constructed from a catalog record and add the two fields, reading them with `.get(...)` so Gaia rows (which lack the columns) stay `None`:

```python
        magnitude_source=rec.get("magnitude_source"),
        color_source=rec.get("color_source"),
```

- [ ] **Step 5: Run the full backend suite**

Run: `cd server && .venv\Scripts\python -m pytest -q`
Expected: PASS — 128 prior + 2 new = 130 passed, 3 deselected.

- [ ] **Step 6: Commit**

```bash
git add server/app/models/schemas.py server/app/routers/sky.py server/tests/test_schemas_enrichment.py
git commit -m "feat(bright-stars): photometry provenance fields on Star"
```

---

### Task 5: Per-star reference epoch

**Files:**
- Modify: `server/app/services/coordinates.py`
- Test: `server/tests/test_coordinates_epoch.py` (create)

**Interfaces:**
- Consumes: an `epoch` column on the stars DataFrame (values `"J2016.0"` or `"J1991.25"`).
- Produces: `coordinates` transforms honouring per-star epochs; `GAIA_REFERENCE_EPOCH` retained as the default for rows without an `epoch` column.

This is the load-bearing correctness change. Write the pin-current-behaviour test **first** so any regression to Gaia rendering is caught immediately.

- [ ] **Step 1: Write the failing test**

Create `server/tests/test_coordinates_epoch.py`:

```python
"""Mixed-epoch astrometry.

Gaia DR3 positions are J2016.0; Hipparcos positions are J1991.25. Propagating a
Hipparcos star from the Gaia epoch applies ~25 years of proper motion in the
wrong direction — small for most stars, badly wrong for high-proper-motion ones.
"""

import pandas as pd
import pytest

from app.services import coordinates

# Barnard's Star-like: enormous proper motion, so an epoch error is unmissable.
FAST_MOVER = {
    "source_id": "test-1",
    "ra": 269.45,
    "dec": 4.69,
    "pmra": -798.0,
    "pmdec": 10328.0,
    "parallax": 546.98,
    "phot_g_mean_mag": 8.2,
    "bp_rp": 2.8,
}

OBSERVER = dict(
    observer_lat=25.76,
    observer_lon=-80.19,
    observer_time="2026-08-17T04:00:00Z",
)


def _frame(**overrides):
    rec = {**FAST_MOVER, **overrides}
    return pd.DataFrame([rec])


def test_gaia_rows_are_unchanged_without_an_epoch_column():
    """Back-compat: a frame with no epoch column behaves exactly as before."""
    without = coordinates.compute_altaz(_frame(), **OBSERVER)
    with_gaia = coordinates.compute_altaz(_frame(epoch="J2016.0"), **OBSERVER)
    assert len(without) == 1
    assert without.iloc[0]["alt"] == pytest.approx(
        with_gaia.iloc[0]["alt"], abs=1e-9
    )


def test_hipparcos_epoch_moves_a_fast_star_measurably():
    """A 25-year epoch difference must actually change where the star lands."""
    gaia = coordinates.compute_altaz(_frame(epoch="J2016.0"), **OBSERVER).iloc[0]
    hipp = coordinates.compute_altaz(_frame(epoch="J1991.25"), **OBSERVER).iloc[0]

    # 10.3 arcsec/yr over ~24.75 yr is ~255 arcsec ~= 0.07 deg of extra motion.
    separation_deg = ((gaia["alt"] - hipp["alt"]) ** 2
                      + (gaia["az"] - hipp["az"]) ** 2) ** 0.5
    assert separation_deg > 0.01


def test_mixed_epochs_in_one_frame_are_handled_per_row():
    df = pd.concat(
        [_frame(source_id="g", epoch="J2016.0"),
         _frame(source_id="h", epoch="J1991.25")],
        ignore_index=True,
    )
    result = coordinates.compute_altaz(df, **OBSERVER)
    assert len(result) == 2
    assert result.iloc[0]["alt"] != pytest.approx(result.iloc[1]["alt"], abs=1e-9)
```

> The entry point is `compute_altaz(stars, observer_lat, observer_lon,
> observer_time, *, horizon_only=False)` — verified against
> `server/app/services/coordinates.py:60`. Do not rename it.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && .venv\Scripts\python -m pytest tests/test_coordinates_epoch.py -q`
Expected: FAIL — the epoch column is ignored, so both epochs give identical alt/az and `test_hipparcos_epoch_moves_a_fast_star_measurably` fails.

- [ ] **Step 3: Honour per-star epochs**

In `server/app/services/coordinates.py`, the transform currently builds one `SkyCoord` with `obstime=GAIA_REFERENCE_EPOCH`. Replace that single value with a per-row array built from the frame's `epoch` column, defaulting to the Gaia epoch when the column is absent:

```python
from astropy.time import Time

# Gaia DR3 reference epoch — the default when a row carries no explicit epoch.
GAIA_REFERENCE_EPOCH = Time("J2016.0")


def _reference_epochs(stars) -> Time:
    """Per-star catalog reference epoch.

    Gaia DR3 is J2016.0; Hipparcos is J1991.25. Frames without an ``epoch``
    column are all-Gaia, which keeps existing callers byte-for-byte unchanged.
    """
    if "epoch" not in stars.columns:
        return Time([GAIA_REFERENCE_EPOCH.jyear_str] * len(stars), format="jyear_str")
    values = stars["epoch"].fillna(GAIA_REFERENCE_EPOCH.jyear_str).astype(str)
    return Time(values.tolist(), format="jyear_str")
```

Then pass `obstime=_reference_epochs(stars)` where `obstime=GAIA_REFERENCE_EPOCH` was used when constructing the source `SkyCoord`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && .venv\Scripts\python -m pytest tests/test_coordinates_epoch.py -q`
Expected: PASS (3 passed).

- [ ] **Step 5: Run the full backend suite — Gaia behaviour must be unchanged**

Run: `cd server && .venv\Scripts\python -m pytest -q`
Expected: PASS — 130 prior + 3 new = 133 passed, 3 deselected. **Every previously passing astrometry test must still pass.** If any existing coordinate test moves even slightly, stop: the default-epoch path has regressed.

- [ ] **Step 6: Commit**

```bash
git add server/app/services/coordinates.py server/tests/test_coordinates_epoch.py
git commit -m "fix(coordinates): per-star reference epoch for mixed catalogs"
```

---

### Task 6: Merge the catalogs

**Files:**
- Modify: `server/app/services/star_catalog.py`
- Test: `server/tests/test_star_catalog_merge.py` (create)

**Interfaces:**
- Consumes: `settings.bright_stars_parquet_path` (Task 3), the `epoch` column (Task 5).
- Produces: `get_catalog()` returning the concatenated frame with `source_id` as string dtype throughout.

- [ ] **Step 1: Write the failing test**

Create `server/tests/test_star_catalog_merge.py`:

```python
import pandas as pd
import pytest

from app.services import star_catalog


@pytest.fixture(autouse=True)
def reset_catalog():
    star_catalog._catalog = None
    yield
    star_catalog._catalog = None


@pytest.fixture
def two_catalogs(tmp_path, monkeypatch):
    gaia = pd.DataFrame(
        [{"source_id": 1576683529448755328, "ra": 193.5, "dec": 55.9,
          "pmra": 1.0, "pmdec": 1.0, "parallax": 40.0,
          "phot_g_mean_mag": 1.73, "bp_rp": 0.02}]
    )
    bright = pd.DataFrame(
        [{"source_id": "hip:32349", "ra": 101.28, "dec": -16.71,
          "pmra": -546.0, "pmdec": -1223.0, "parallax": 379.21,
          "phot_g_mean_mag": -1.46, "bp_rp": 0.0,
          "epoch": "J1991.25", "source": "ESA Hipparcos",
          "magnitude_source": "derived", "color_source": "derived"}]
    )
    gaia_path = tmp_path / "gaia.parquet"
    bright_path = tmp_path / "bright.parquet"
    gaia.to_parquet(gaia_path, engine="pyarrow", index=False)
    bright.to_parquet(bright_path, engine="pyarrow", index=False)

    monkeypatch.setattr(star_catalog.settings, "gaia_parquet_path", gaia_path)
    monkeypatch.setattr(star_catalog.settings, "bright_stars_parquet_path", bright_path)
    return gaia_path, bright_path


def test_catalog_contains_both_sources(two_catalogs):
    df = star_catalog.get_catalog()
    assert len(df) == 2
    assert set(df["source_id"]) == {"1576683529448755328", "hip:32349"}


def test_source_id_is_string_dtype_throughout(two_catalogs):
    """Gaia ids are int64 on disk and exceed JS MAX_SAFE_INTEGER; the merged
    frame must be strings so the two catalogs concatenate cleanly."""
    df = star_catalog.get_catalog()
    assert all(isinstance(s, str) for s in df["source_id"])


def test_gaia_rows_get_the_default_epoch(two_catalogs):
    df = star_catalog.get_catalog()
    gaia_row = df[df["source_id"] == "1576683529448755328"].iloc[0]
    assert gaia_row["epoch"] == "J2016.0"
    assert gaia_row["source"] == "Gaia DR3"


def test_bright_rows_keep_their_own_epoch_and_source(two_catalogs):
    df = star_catalog.get_catalog()
    hip_row = df[df["source_id"] == "hip:32349"].iloc[0]
    assert hip_row["epoch"] == "J1991.25"
    assert hip_row["source"] == "ESA Hipparcos"


def test_magnitude_filter_spans_both_catalogs(two_catalogs):
    visible = star_catalog.query_visible_stars(mag_limit=0.0)
    # Only Sirius at G = -1.46 is brighter than 0.0.
    assert list(visible["source_id"]) == ["hip:32349"]


def test_missing_bright_parquet_raises_actionable_error(two_catalogs, monkeypatch):
    from pathlib import Path

    monkeypatch.setattr(
        star_catalog.settings, "bright_stars_parquet_path", Path("does/not/exist.parquet")
    )
    with pytest.raises(star_catalog.CatalogNotIngestedError) as exc:
        star_catalog.get_catalog()
    assert "ingest_bright_stars" in str(exc.value)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && .venv\Scripts\python -m pytest tests/test_star_catalog_merge.py -q`
Expected: FAIL — `get_catalog()` loads only the Gaia parquet, so the merged frame has 1 row.

- [ ] **Step 3: Implement the merge**

In `server/app/services/star_catalog.py`, replace `get_catalog` and add a merge helper:

```python
# Catalog reference epochs. Gaia rows carry no epoch column of their own.
GAIA_EPOCH = "J2016.0"
GAIA_SOURCE = "Gaia DR3"


def _merge_catalogs(gaia: pd.DataFrame, bright: pd.DataFrame) -> pd.DataFrame:
    """Concatenate the Gaia catalog with the bright-star supplement.

    Gaia source_ids are int64 on disk and exceed JS MAX_SAFE_INTEGER, so both
    frames are cast to string before concatenation — otherwise the mixed column
    lands as object dtype with ints still inside it.

    The supplement is already deduped against Gaia at ingest time
    (scripts/ingest_bright_stars.py), so no dedupe happens here.
    """
    gaia = gaia.copy()
    gaia["source_id"] = gaia["source_id"].astype(str)
    gaia["epoch"] = GAIA_EPOCH
    gaia["source"] = GAIA_SOURCE

    bright = bright.copy()
    bright["source_id"] = bright["source_id"].astype(str)

    return pd.concat([gaia, bright], ignore_index=True, sort=False)


def get_catalog() -> pd.DataFrame:
    """Return the in-memory star catalog, loading and merging on first call."""
    global _catalog
    if _catalog is None:
        gaia = _load_catalog(settings.gaia_parquet_path)
        bright = _load_bright_stars(settings.bright_stars_parquet_path)
        _catalog = _merge_catalogs(gaia, bright)
        logger.info("Merged star catalog: %s rows", f"{len(_catalog):,}")
    return _catalog
```

And add the loader beside `_load_catalog`:

```python
def _load_bright_stars(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise CatalogNotIngestedError(
            f"Bright-star supplement not found at {path}. "
            f"Run `python scripts/ingest_bright_stars.py` to generate it."
        )
    df = pd.read_parquet(path, engine="pyarrow")
    logger.info("Loaded bright-star supplement: %s rows", f"{len(df):,}")
    return df
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && .venv\Scripts\python -m pytest tests/test_star_catalog_merge.py -q`
Expected: PASS (6 passed).

- [ ] **Step 5: Run the full backend suite**

Run: `cd server && .venv\Scripts\python -m pytest -q`
Expected: PASS — 133 prior + 6 new = 139 passed, 3 deselected.

- [ ] **Step 6: Commit**

```bash
git add server/app/services/star_catalog.py server/tests/test_star_catalog_merge.py
git commit -m "feat(bright-stars): merge the supplement into the star catalog"
```

---

### Task 7: Enrich the `hip:` stars

**Files:**
- Modify: `server/scripts/ingest_star_enrichment.py`
- Modify: `server/app/services/enrichment/simbad.py`
- Test: `server/tests/test_star_enrichment_ingest.py` (append)

**Interfaces:**
- Consumes: `build_name_fields`, `merge_enrichment` (existing), `TAP_ROW_CAP` and `_clean` from `enrichment/simbad.py`.
- Produces: `fetch_simbad_by_hip(hip_ids: list[str], chunk_size: int) -> dict`, keyed by `hip:<HIP>`.

The bright stars are exactly the ones with proper names — without this, clicking Vega still shows a bare Gaia-style header.

- [ ] **Step 1: Write the failing test**

Append to `server/tests/test_star_enrichment_ingest.py`:

```python
def test_merge_enrichment_accepts_hip_prefixed_keys():
    """hip: ids must flow through the merge unchanged — they key the same file."""
    simbad = {
        "hip:91262": {
            "proper_name": "Vega",
            "designation": "α Lyrae",
            "catalog_ids": ["HD 172167", "HIP 91262"],
            "spectral_type": "A0Va",
            "object_type": "Variable Star",
        }
    }
    merged = merge_enrichment(simbad, {})
    entry = merged["hip:91262"]
    assert entry["proper_name"] == "Vega"
    assert entry["name_source"] == "SIMBAD/CDS"
    assert entry["planets"] is None
```

- [ ] **Step 2: Run test to verify it passes already**

Run: `cd server && .venv\Scripts\python -m pytest tests/test_star_enrichment_ingest.py -q`
Expected: PASS — `merge_enrichment` is key-agnostic. This test pins that property so a later change cannot break `hip:` keys silently.

- [ ] **Step 3: Add the HIP resolution path**

Append to `server/app/services/enrichment/simbad.py`:

```python
def fetch_simbad_by_hip(hip_ids: list[str], chunk_size: int = 300) -> dict:
    """Resolve HIP ids to SIMBAD names/spectral type, keyed by ``hip:<HIP>``.

    Same shape and same row-cap discipline as fetch_simbad, but keyed on the
    Hipparcos identifier because these stars have no Gaia row (that is precisely
    why they were supplemented).
    """
    from scripts.ingest_star_enrichment import build_name_fields

    ident_filter = " OR ".join(f"allids.id LIKE '{p}%'" for p in _IDENT_PREFIXES)

    out: dict = {}
    for start in range(0, len(hip_ids), chunk_size):
        chunk = hip_ids[start : start + chunk_size]
        id_list = ", ".join(f"'HIP {h}'" for h in chunk)
        query = f"""
            SELECT hip.id AS hip_id, b.sp_type AS sp_type,
                   od.otype_longname AS otype, allids.id AS ident
            FROM ident AS hip
            JOIN basic AS b ON b.oid = hip.oidref
            LEFT JOIN ident AS allids
                   ON allids.oidref = b.oid AND ({ident_filter})
            LEFT JOIN otypedef AS od ON od.otype = b.otype
            WHERE hip.id IN ({id_list})
        """
        table = Simbad.query_tap(query)
        if len(table) >= TAP_ROW_CAP:
            raise RuntimeError(
                f"SIMBAD returned {len(table)} rows for a {len(chunk)}-star "
                f"chunk, at or above the {TAP_ROW_CAP}-row TAP cap — the result "
                f"is truncated. Lower chunk_size."
            )

        by_star: dict = {}
        for row in table:
            hip = str(row["hip_id"]).replace("HIP ", "").strip()
            rec = by_star.setdefault(
                hip,
                {
                    "idents": [],
                    "sp_type": _clean(row["sp_type"]),
                    "otype": _clean(row["otype"]),
                },
            )
            ident = _clean(row["ident"])
            if ident:
                rec["idents"].append(ident)

        for hip, rec in by_star.items():
            proper, designation, catalog_ids = build_name_fields(rec["idents"])
            out[f"hip:{hip}"] = {
                "proper_name": proper,
                "designation": designation,
                "catalog_ids": catalog_ids,
                "spectral_type": rec["sp_type"],
                "object_type": rec["otype"],
            }
        logger.info("SIMBAD (HIP) resolved %d/%d so far", len(out), start + len(chunk))
    return out
```

- [ ] **Step 4: Call it from the enrichment bake**

In `server/scripts/ingest_star_enrichment.py`, inside `main()`, after the existing `fetch_simbad(...)` call, add the supplement pass and merge the two maps:

```python
    from app.services.enrichment.simbad import fetch_simbad_by_hip

    bright = pd.read_parquet(
        settings.bright_stars_parquet_path, columns=["source_id"]
    )
    hip_ids = [s.removeprefix("hip:") for s in bright["source_id"].astype(str)]
    logger.info("Bright stars to resolve by HIP: %d", len(hip_ids))

    simbad.update(fetch_simbad_by_hip(hip_ids))
```

Add `import pandas as pd` to `main()`'s imports if it is not already there.

- [ ] **Step 5: Re-run the enrichment bake (network required)**

Run: `cd server && .venv\Scripts\python scripts/ingest_star_enrichment.py`

Expected: the entry count rises by roughly the number of bright stars added in Task 3. Spot-check that Vega is now present:

```bash
.venv\Scripts\python -c "import json; d=json.load(open('data/star_enrichment.json', encoding='utf-8')); print([ (k,v['proper_name']) for k,v in d.items() if isinstance(v,dict) and v.get('proper_name') in ('Vega','Sirius','Betelgeuse') ])"
```

Expected: Vega, Sirius and Betelgeuse all appear with `hip:`-prefixed keys.

- [ ] **Step 6: Commit**

```bash
git add server/app/services/enrichment/simbad.py server/scripts/ingest_star_enrichment.py server/tests/test_star_enrichment_ingest.py server/data/star_enrichment.json
git commit -m "feat(bright-stars): enrich hip: stars by Hipparcos identifier"
```

---

### Task 8: Acceptance gate

**Files:**
- Create: `server/scripts/verify_bright_stars.py`

**Interfaces:**
- Consumes: `star_catalog.get_catalog()`, `settings.bright_stars_parquet_path`.
- Produces: an executable that exits 0 on success, 1 on failure.

The single highest-value artifact here. It would have caught both the missing bright stars and the SIMBAD row-cap truncation on day one.

- [ ] **Step 1: Write the verifier**

Create `server/scripts/verify_bright_stars.py`:

```python
"""Acceptance gate for the bright-star supplement.

Fails loudly if any canonical naked-eye star is missing from the merged catalog,
positioned wrong, or duplicated. Run after touching the ingest or merge path:

    cd server
    python scripts/verify_bright_stars.py

Reference positions are ICRS J2000 from SIMBAD, quoted to arcsecond precision.
"""

from __future__ import annotations

import sys

from app.services import star_catalog

# (name, ra_deg, dec_deg, approx V) — the stars any observer can name.
CANONICAL = [
    ("Sirius",      101.287155, -16.716116, -1.46),
    ("Canopus",      95.987958, -52.695661, -0.74),
    ("Arcturus",    213.915300,  19.182409, -0.05),
    ("Vega",        279.234735,  38.783689,  0.03),
    ("Capella",      79.172328,  45.997991,  0.08),
    ("Rigel",        78.634467,  -8.201638,  0.13),
    ("Procyon",     114.825498,   5.224993,  0.34),
    ("Achernar",     24.428523, -57.236753,  0.46),
    ("Betelgeuse",   88.792939,   7.407064,  0.50),
    ("Altair",      297.695827,   8.868322,  0.77),
    ("Aldebaran",    68.980163,  16.509302,  0.85),
    ("Antares",     247.351915, -26.432003,  1.09),
    ("Spica",       201.298247, -11.161319,  1.04),
    ("Pollux",      116.328958,  28.026199,  1.14),
    ("Fomalhaut",   344.412693, -29.622237,  1.16),
    ("Deneb",       310.357980,  45.280339,  1.25),
    ("Regulus",     152.092962,  11.967208,  1.40),
    ("Castor",      113.649428,  31.888276,  1.58),
    ("Bellatrix",    81.282764,   6.349703,  1.64),
    ("Polaris",      37.954561,  89.264109,  1.98),
]

TOLERANCE_ARCSEC = 1.0


def _angular_sep_arcsec(ra1, dec1, ra2, dec2) -> float:
    from astropy.coordinates import SkyCoord
    import astropy.units as u

    a = SkyCoord(ra=ra1 * u.deg, dec=dec1 * u.deg)
    b = SkyCoord(ra=ra2 * u.deg, dec=dec2 * u.deg)
    return a.separation(b).arcsec


def main() -> int:
    catalog = star_catalog.get_catalog()
    print(f"merged catalog: {len(catalog):,} stars")
    print(f"{'star':<12} {'sep (arcsec)':>13}  status")
    print("-" * 42)

    failures: list[str] = []

    for name, ra, dec, vmag in CANONICAL:
        # Match by position: the catalog keys on ids, not names.
        near = catalog[
            (catalog["ra"] - ra).abs().lt(0.05)
            & (catalog["dec"] - dec).abs().lt(0.05)
        ]
        if near.empty:
            print(f"{name:<12} {'--':>13}  MISSING")
            failures.append(f"{name} absent from the merged catalog")
            continue
        if len(near) > 1:
            print(f"{name:<12} {'--':>13}  DUPLICATED ({len(near)})")
            failures.append(f"{name} appears {len(near)} times")
            continue

        row = near.iloc[0]
        sep = _angular_sep_arcsec(row["ra"], row["dec"], ra, dec)
        ok = sep <= TOLERANCE_ARCSEC
        print(f"{name:<12} {sep:>13.3f}  {'ok' if ok else 'TOO FAR'}")
        if not ok:
            failures.append(f"{name} is {sep:.2f} arcsec from its published position")

    print()
    if failures:
        print(f"FAILED — {len(failures)} problem(s):")
        for f in failures:
            print(f"  - {f}")
        return 1

    print(f"OK — all {len(CANONICAL)} canonical stars present within "
          f"{TOLERANCE_ARCSEC} arcsec.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Run the verifier**

Run: `cd server && .venv\Scripts\python scripts/verify_bright_stars.py`
Expected: exit 0, all 20 stars listed `ok`.

If any star reports MISSING, the dedupe in Task 3 dropped it wrongly. If any reports DUPLICATED, the cross-match failed to match it and it exists in both catalogs. Either way, stop and fix the ingest — do not loosen the tolerance to make the gate pass.

> The photometric transform is validated separately, at ingest time, by
> `_log_photometry_residuals` in Task 3 — that is the only point where a star has
> both a derived and a measured G. It raises if the RMS residual exceeds 0.25 mag
> against the relation's 0.04772 quoted scatter.

- [ ] **Step 3: Commit**

```bash
git add server/scripts/verify_bright_stars.py
git commit -m "feat(bright-stars): acceptance gate for canonical naked-eye stars"
```

---

### Task 9: Frontend handles `hip:` ids

**Files:**
- Test: `client/src/__tests__/useObject.test.jsx` (append)
- Test: `client/src/__tests__/SkyTooltip.test.jsx` (append)

**Interfaces:**
- Consumes: `api.object(sourceId)`, `useObject`, `SkyTooltip` — all unchanged.
- Produces: no production code. This task proves the existing frontend already
  handles the new id shape, and pins that so a future change cannot break it.

A `hip:` id contains a colon, which is legal in a URL path segment (RFC 3986) but
is exactly the sort of thing that breaks silently in a fetch wrapper. Verify
rather than assume.

- [ ] **Step 1: Write the tests**

Append to `client/src/__tests__/useObject.test.jsx`, inside the existing
`describe("useObject", ...)` block:

```javascript
  it("passes a hip: prefixed source_id through unencoded", async () => {
    api.object.mockResolvedValue({
      found: true,
      enrichment: { proper_name: "Vega" },
    });
    const { result } = renderHook(() => useObject("hip:91262", true), { wrapper });
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(api.object).toHaveBeenCalledWith("hip:91262");
  });
```

Append to `client/src/__tests__/SkyTooltip.test.jsx`, inside the existing
`describe("SkyTooltip star enrichment", ...)` block:

```javascript
  it("renders a Hipparcos-supplied star with its provenance", () => {
    const hipStar = { ...baseStar, source_id: "hip:91262", source: "ESA Hipparcos" };
    const enrichment = {
      source_id: "hip:91262",
      proper_name: "Vega",
      designation: "α Lyrae",
      catalog_ids: ["HD 172167"],
      spectral_type: "A0Va",
      planets: null,
      sources: ["SIMBAD/CDS"],
    };
    render(
      <SkyTooltip object={hipStar} enrichment={enrichment} container={container} />
    );
    expect(screen.getByText("Vega")).toBeInTheDocument();
    expect(screen.getByText("A0Va")).toBeInTheDocument();
  });

  it("falls back to the Hipparcos id header when a hip: star has no enrichment", () => {
    const hipStar = { ...baseStar, source_id: "hip:91262", source: "ESA Hipparcos" };
    render(<SkyTooltip object={hipStar} container={container} />);
    expect(screen.getByText(/hip:91262/)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests**

Run: `cd client && npx vitest run src/__tests__/useObject.test.jsx src/__tests__/SkyTooltip.test.jsx`

Expected: PASS. If the second tooltip test fails, `StarBody`'s fallback header
hardcodes the string `Gaia DR3 · {source_id}` — change it to read `object.source`
so a Hipparcos star is not mislabelled as Gaia:

```jsx
              {object.source} · {object.source_id}
```

That is a real attribution bug if it fires (guardrail #4), not a test to relax.

- [ ] **Step 3: Run the full frontend suite**

Run: `cd client && npx vitest run && npm run lint`
Expected: 193 prior + 3 new = 196 passed; lint clean.

- [ ] **Step 4: Commit**

```bash
git add client/src/__tests__/useObject.test.jsx client/src/__tests__/SkyTooltip.test.jsx client/src/components/hero/SkyTooltip.jsx
git commit -m "test(bright-stars): hip: ids round-trip through the tooltip"
```

---

### Task 10: Attribution, docs, and final verification

**Files:**
- Modify: `client/src/components/hero/AttributionFooter.jsx`
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Credit Hipparcos for star positions**

In `client/src/components/hero/AttributionFooter.jsx`, change the stars line to name both catalogs:

```jsx
      <div>Stars: ESA Gaia DR3 + ESA Hipparcos · Planets: NASA JPL DE421</div>
```

- [ ] **Step 2: Update the README data-source table**

In `README.md`, update the Hipparcos row so it covers both uses and add the photometric relation:

```markdown
| **ESA Hipparcos** (VizieR I/239/hip_main) | J2000 ICRS coordinates for constellation stars, plus the bright naked-eye stars Gaia DR3 saturates on (G < 1.73) | ESA | Public / scientific data |
| **Gaia EDR3 photometric relations** (Riello et al. 2021, Table 5.7) | Johnson V/B−V/V−I → Gaia G and BP−RP transforms for the Hipparcos supplement | ESA / DPAC | Published, cited |
```

- [ ] **Step 3: Update CLAUDE.md**

- Add ESA Hipparcos to the **Tier 1** data-source table as a star-position source, not just constellation coordinates.
- Add guardrail **#26**:

> **26. Star positions come from two catalogs with two epochs.** Gaia DR3 (J2016.0) plus an ESA Hipparcos supplement (J1991.25) for the bright stars Gaia saturates on — its parquet bottoms out at G = 1.73, so without the supplement Sirius, Vega, Betelgeuse and every other famous star are simply absent. `coordinates.py` propagates proper motion from each row's own `epoch`; **never reintroduce a single global reference epoch**. The supplement is deduped against Gaia at ingest via SIMBAD's exact HIP↔Gaia DR3 mapping and Gaia always wins, so a star must never appear twice. Hipparcos photometry is transformed to the Gaia scale using the published Gaia EDR3 relations (Riello et al. 2021, Table 5.7) — coefficients are transcribed and cited, never derived, and every transformed value carries `magnitude_source`/`color_source`. Run `scripts/verify_bright_stars.py` after touching the ingest or merge path; it fails if any canonical star is missing, duplicated, or more than 1 arcsec off.

- Update the Phase Status and Resume sections to record the supplement.

- [ ] **Step 4: Full verification**

```bash
cd server && .venv\Scripts\python -m pytest -q
cd server && .venv\Scripts\python -m pytest -q -m "network or not network"
cd server && .venv\Scripts\python scripts/verify_bright_stars.py
cd server && .venv\Scripts\python scripts/verify_backdrop_projection.py
cd client && npm run lint && npx vitest run && npm run build
```

Expected: backend **139** default + **5** network green; frontend **196** green; lint clean; both verifier scripts exit 0.

These counts are the plan's arithmetic, not a contract — if a task legitimately adds a test the plan did not anticipate, the number moving is fine. A number moving *down* is not.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/hero/AttributionFooter.jsx README.md CLAUDE.md
git commit -m "docs(bright-stars): Hipparcos attribution + guardrail #26"
```

---

## Final verification

- [ ] `scripts/verify_bright_stars.py` exits 0 — all 20 canonical stars present, unique, within 1 arcsec.
- [ ] `scripts/verify_backdrop_projection.py` still exits 0 (worst separation ≤ 0.6°).
- [ ] Backend suite green including `network`-marked tests.
- [ ] Frontend suite green, lint clean, build succeeds.
- [ ] Manual: start both servers, pick a location and time where Sirius or Vega is up. The star renders, is clearly one of the brightest on the chart, and clicking it shows its proper name and spectral type. No star appears twice.
- [ ] Andrew's live visual QA + merge decision.
