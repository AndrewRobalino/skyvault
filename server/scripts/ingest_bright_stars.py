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
import math

import numpy as np

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
    magnitude, so dropping the star is honest and inventing one is not. Same for
    the few hundred Hipparcos entries with no astrometric solution.
    """
    ra = _opt_float(rec.get("RAICRS"))
    dec = _opt_float(rec.get("DEICRS"))
    v = _opt_float(rec.get("Vmag"))
    b_v = _opt_float(rec.get("B-V"))
    v_i = _opt_float(rec.get("V-I"))
    if ra is None or dec is None or v is None:
        return None

    g = gaia_g_from_v_bv(v, b_v)
    if g is None:
        return None

    bp_rp = bp_rp_from_v_i(v_i)

    return {
        "source_id": hip_source_id(rec["HIP"]),
        "ra": ra,
        "dec": dec,
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


# --- Positional dedupe -----------------------------------------------------
# select_missing() alone is not enough. For hundreds of naked-eye stars SIMBAD
# links only a *Gaia DR2* id, and ESA's own gaiadr3.hipparcos2_best_neighbour
# omits the same stars, so no identifier path reaches the DR3 source that is
# sitting in our parquet. The 2026-08-17 bake kept 656 stars; ~578 of them had
# a Gaia source within 1 arcsec and would have rendered twice. Position plus
# magnitude against our own parquet is the check that actually answers "is
# this star already on the chart".

GAIA_EPOCH_YEARS = 2016.0 - 1991.25

DEDUPE_RADIUS_ARCSEC = 3.0

# Derived G minus Gaia G for the same star. Negative = Hipparcos brighter,
# which is what a binary Gaia resolves looks like (combined light vs one
# component). Every <1 arcsec pair in the 2026-08-17 bake fell in [-1.5, +0.25].
# Outside this window a close neighbour is a different star, e.g. a saturated
# Sirius next to an unrelated G = 8.5 field star.
DEDUPE_DG_RANGE = (-1.5, 0.5)

# After dedupe, no kept star may have any Gaia source this close. Tripping it
# means the magnitude window let a real duplicate through, so stop the bake.
TWIN_GUARD_ARCSEC = 1.0


def propagate_to_gaia_epoch(
    ra: float, dec: float, pmra: float | None, pmdec: float | None
) -> tuple[float, float]:
    """Move a J1991.25 Hipparcos position to Gaia's J2016.0 epoch.

    Linear proper motion only. Over 24.75 years the error from ignoring
    curvature, parallax and radial velocity is far below the match radius.
    Hipparcos pmRA already includes the cos(dec) factor.
    """
    if pmra is None and pmdec is None:
        return ra, dec
    mas_to_deg = GAIA_EPOCH_YEARS / 3.6e6
    cos_dec = max(math.cos(math.radians(dec)), 1e-9)
    return (
        ra + (pmra or 0.0) * mas_to_deg / cos_dec,
        dec + (pmdec or 0.0) * mas_to_deg,
    )


def _unit_vectors(ra_deg: np.ndarray, dec_deg: np.ndarray) -> np.ndarray:
    ra, dec = np.radians(ra_deg), np.radians(dec_deg)
    return np.stack(
        [np.cos(dec) * np.cos(ra), np.cos(dec) * np.sin(ra), np.sin(dec)], axis=1
    )


def _gaia_neighbours(row: dict, gaia_vecs: np.ndarray, radius_arcsec: float) -> np.ndarray:
    """Indices of Gaia sources within radius of the row's J2016.0 position."""
    ra, dec = propagate_to_gaia_epoch(row["ra"], row["dec"], row.get("pmra"), row.get("pmdec"))
    vec = _unit_vectors(np.array([ra]), np.array([dec]))[0]
    min_dot = math.cos(math.radians(radius_arcsec / 3600))
    return np.flatnonzero(gaia_vecs @ vec >= min_dot)


def drop_positional_duplicates(rows: list[dict], gaia) -> list[dict]:
    """Drop supplement rows that match a Gaia source by position and magnitude.

    ``gaia`` is a frame with ra, dec (J2016.0) and phot_g_mean_mag.
    """
    gaia_vecs = _unit_vectors(gaia["ra"].to_numpy(), gaia["dec"].to_numpy())
    gaia_g = gaia["phot_g_mean_mag"].to_numpy()
    low, high = DEDUPE_DG_RANGE

    kept: list[dict] = []
    for row in rows:
        near = _gaia_neighbours(row, gaia_vecs, DEDUPE_RADIUS_ARCSEC)
        d_g = row["phot_g_mean_mag"] - gaia_g[near]
        if np.any((d_g >= low) & (d_g <= high)):
            continue
        kept.append(row)
    return kept


def assert_no_gaia_twins(rows: list[dict], gaia) -> None:
    """Fail the bake if any kept star still has a Gaia source within 1 arcsec."""
    gaia_vecs = _unit_vectors(gaia["ra"].to_numpy(), gaia["dec"].to_numpy())
    twins = [
        row["source_id"]
        for row in rows
        if len(_gaia_neighbours(row, gaia_vecs, TWIN_GUARD_ARCSEC))
    ]
    if twins:
        raise RuntimeError(
            f"{len(twins)} supplement stars still have a Gaia source within "
            f"{TWIN_GUARD_ARCSEC} arcsec and would render twice: {twins[:10]}. "
            f"Check DEDUPE_DG_RANGE against the photometry residuals."
        )


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
        settings.gaia_parquet_path, columns=["source_id", "ra", "dec", "phot_g_mean_mag"]
    )
    gaia_df["source_id"] = gaia_df["source_id"].astype(str)
    gaia_ids = set(gaia_df["source_id"])
    logger.info("Gaia source_ids in catalog: %d", len(gaia_ids))

    _log_photometry_residuals(records, hip_to_gaia, gaia_df)

    rows = select_missing(records, hip_to_gaia, gaia_ids)
    logger.info("After identifier dedupe: %d", len(rows))

    rows = drop_positional_duplicates(rows, gaia_df)
    assert_no_gaia_twins(rows, gaia_df)
    logger.info("Bright stars Gaia lacks (after positional dedupe): %d", len(rows))

    df = pd.DataFrame(rows)
    out_path = settings.bright_stars_parquet_path
    df.to_parquet(out_path, engine="pyarrow", index=False)
    logger.info("Wrote %s (%d rows)", out_path, len(df))


if __name__ == "__main__":
    main()
