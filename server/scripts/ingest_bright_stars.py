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
