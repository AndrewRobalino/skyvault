"""Mixed-epoch astrometry.

Gaia DR3 positions are J2016.0; Hipparcos positions are J1991.25. Propagating a
Hipparcos star from the Gaia epoch applies ~25 years of proper motion in the
wrong direction — small for most stars, badly wrong for high-proper-motion ones.
"""

import math

import pandas as pd
import pytest

from app.services import coordinates

# Barnard's Star, the largest proper motion in the sky (~10.4 arcsec/yr), as
# each catalog actually publishes it. Values from VizieR I/239/hip_main and
# our Gaia DR3 parquet.
BARNARD_HIPPARCOS = {
    "source_id": "hip:87937",
    "ra": 269.45402305,
    "dec": 4.66828815,
    "pmra": -797.84,
    "pmdec": 10326.93,
    "parallax": 549.01,
    "phot_g_mean_mag": 8.2,
    "epoch": "J1991.25",
}
BARNARD_GAIA = {
    "source_id": "4472832130942575872",
    "ra": 269.448502525438,
    "dec": 4.739420051112,
    "pmra": -801.550978368471,
    "pmdec": 10362.394206546573,
    "parallax": 546.975939730948,
    "phot_g_mean_mag": 8.19,
}

OBSERVER = dict(
    observer_lat=25.76,
    observer_lon=-80.19,
    observer_time="2026-08-17T04:00:00Z",
)


def _frame(*recs):
    return pd.DataFrame(list(recs))


def _separation_arcsec(a, b) -> float:
    """Great-circle distance between two alt/az rows."""
    alt1, az1, alt2, az2 = map(math.radians, (a["alt"], a["az"], b["alt"], b["az"]))
    cos_sep = (math.sin(alt1) * math.sin(alt2)
               + math.cos(alt1) * math.cos(alt2) * math.cos(az1 - az2))
    return math.degrees(math.acos(min(1.0, cos_sep))) * 3600


def test_gaia_rows_are_unchanged_without_an_epoch_column():
    """Back-compat: a frame with no epoch column behaves exactly as before."""
    without = coordinates.compute_altaz(_frame(BARNARD_GAIA), **OBSERVER).iloc[0]
    with_gaia = coordinates.compute_altaz(
        _frame({**BARNARD_GAIA, "epoch": "J2016.0"}), **OBSERVER
    ).iloc[0]
    assert without["alt"] == with_gaia["alt"]
    assert without["az"] == with_gaia["az"]


def test_hipparcos_and_gaia_barnard_land_on_the_same_spot():
    """Each catalog's own row, propagated from its own epoch, must agree.

    Treating the Hipparcos row as J2016.0 would put it ~255 arcsec behind.
    """
    hip, gaia = coordinates.compute_altaz(
        _frame(BARNARD_HIPPARCOS, BARNARD_GAIA), **OBSERVER
    ).to_dict("records")
    assert _separation_arcsec(hip, gaia) < 2.0


def test_hipparcos_epoch_is_not_ignored():
    as_hip = coordinates.compute_altaz(_frame(BARNARD_HIPPARCOS), **OBSERVER).iloc[0]
    as_gaia_epoch = coordinates.compute_altaz(
        _frame({**BARNARD_HIPPARCOS, "epoch": "J2016.0"}), **OBSERVER
    ).iloc[0]
    assert _separation_arcsec(as_hip, as_gaia_epoch) == pytest.approx(255, abs=10)


def test_missing_epoch_in_a_mixed_frame_defaults_to_gaia():
    # After pd.concat, a Gaia row can carry NaN in the epoch column.
    gaia_nan = {**BARNARD_GAIA, "epoch": float("nan")}
    hip, gaia = coordinates.compute_altaz(
        _frame(BARNARD_HIPPARCOS, gaia_nan), **OBSERVER
    ).to_dict("records")
    assert _separation_arcsec(hip, gaia) < 2.0
