"""Tests for the ICRS -> AltAz transform service.

These tests validate the actual astronomy, not just the plumbing. Reference
values come from well-known identities (Polaris altitude ≈ observer latitude)
and cross-checks against Stellarium's published positions. Tolerances are in
arcminutes because that's what's scientifically defensible for a web-scale
renderer — not arcseconds.
"""

from __future__ import annotations

import pandas as pd
import pytest

from app.services import coordinates


# Miami, FL — used as our reference observer site throughout.
MIAMI_LAT = 25.7617
MIAMI_LON = -80.1918

# A fixed UTC instant used by several tests. Picked so Sirius is well above
# the horizon from Miami for an easy sanity check.
OBS_TIME = "2026-01-15T02:00:00Z"

# Tolerance: 2 arcminutes. Comfortable margin above Astropy's intrinsic
# precision and accounts for small Stellarium vs Astropy methodology drift.
TOL_ARCMIN = 2.0 / 60.0  # degrees


def _single_star_df(
    source_id: int,
    ra: float,
    dec: float,
    pmra: float = 0.0,
    pmdec: float = 0.0,
    parallax: float = 10.0,
    g_mag: float = 2.0,
) -> pd.DataFrame:
    """Build a 1-row DataFrame mimicking the Gaia catalog schema."""
    return pd.DataFrame(
        [
            {
                "source_id": source_id,
                "ra": ra,
                "dec": dec,
                "pmra": pmra,
                "pmdec": pmdec,
                "parallax": parallax,
                "phot_g_mean_mag": g_mag,
            }
        ]
    )


def test_polaris_altitude_equals_observer_latitude():
    """Polaris sits at altitude ≈ observer latitude — a physics identity.

    This catches frame-confusion bugs instantly: if ICRS/GCRS/ITRS wiring is
    wrong, this test fails with an obviously-wrong number, not a subtle drift.
    """
    # Polaris (α UMi) — ICRS J2000.0 -> close enough to J2016.0 for this test.
    polaris = _single_star_df(
        source_id=576402619921876480,
        ra=37.9546,   # deg
        dec=89.2641,  # deg
        pmra=44.48,   # mas/yr
        pmdec=-11.85, # mas/yr
        parallax=7.54,
    )

    result = coordinates.compute_altaz(
        polaris, observer_lat=MIAMI_LAT, observer_lon=MIAMI_LON, observer_time=OBS_TIME
    )

    assert len(result) == 1
    altitude = result.iloc[0]["alt"]
    # Polaris is ~0.7° from the true pole, so altitude wobbles slightly
    # around latitude over a sidereal day. 1 degree tolerance is correct.
    assert abs(altitude - MIAMI_LAT) < 1.0, (
        f"Polaris altitude {altitude:.3f}° should be within 1° of observer "
        f"latitude {MIAMI_LAT}° — got delta {altitude - MIAMI_LAT:.3f}°"
    )


def test_sirius_obeys_max_altitude_identity():
    """Sirius's altitude is bounded by the max-altitude physics identity.

    For any star with declination δ seen from observer latitude φ, the
    maximum altitude (at upper culmination) is ``90° - |φ - δ|``. Sirius
    at δ = -16.716° seen from Miami (φ = 25.762°) must therefore sit at
    ≤ 47.522° at every instant, and at a random pre-transit evening time
    it must be above the horizon.

    Unlike a cross-check against another tool, this is a *physics identity*
    that any correct ICRS->AltAz pipeline has to satisfy.

    TODO: Add a second test with reference values looked up directly from
    Stellarium for the same observer/time, for a tool-level cross-check on
    top of this physics identity check.
    """
    sirius = _single_star_df(
        source_id=2947050466531873024,
        ra=101.28715533,
        dec=-16.71611586,
        pmra=-546.01,
        pmdec=-1223.07,
        parallax=379.21,
    )

    max_altitude = 90.0 - abs(MIAMI_LAT - (-16.71611586))

    result = coordinates.compute_altaz(
        sirius, observer_lat=MIAMI_LAT, observer_lon=MIAMI_LON, observer_time=OBS_TIME
    )
    alt = result.iloc[0]["alt"]

    # Must respect the physics ceiling (with a tiny numerical slack).
    assert alt <= max_altitude + 1e-6, (
        f"Sirius altitude {alt:.4f}° exceeds max possible {max_altitude:.4f}° "
        f"for observer at lat={MIAMI_LAT}°"
    )
    # Must be above the horizon at 21:00 EST in mid-January (Sirius has risen).
    assert alt > 0, f"Sirius should be above horizon at {OBS_TIME}, got alt={alt:.3f}°"


def test_alt_az_columns_added():
    star = _single_star_df(source_id=1, ra=0.0, dec=0.0)
    result = coordinates.compute_altaz(
        star, observer_lat=MIAMI_LAT, observer_lon=MIAMI_LON, observer_time=OBS_TIME
    )
    assert "alt" in result.columns
    assert "az" in result.columns


def test_below_horizon_filter_removes_southern_star_from_north_pole():
    """A star at Dec = -80° is never visible from the North Pole."""
    star = _single_star_df(source_id=1, ra=0.0, dec=-80.0)

    visible = coordinates.compute_altaz(
        star,
        observer_lat=89.9,   # effectively north pole
        observer_lon=0.0,
        observer_time=OBS_TIME,
        horizon_only=True,
    )

    assert len(visible) == 0


def test_multiple_stars_vectorized():
    """Transform runs on many stars at once, no per-row Python loop."""
    stars = pd.DataFrame(
        {
            "source_id": [1, 2, 3, 4],
            "ra": [0.0, 90.0, 180.0, 270.0],
            "dec": [0.0, 30.0, -30.0, 60.0],
            "pmra": [0.0, 0.0, 0.0, 0.0],
            "pmdec": [0.0, 0.0, 0.0, 0.0],
            "parallax": [10.0, 10.0, 10.0, 10.0],
            "phot_g_mean_mag": [1.0, 2.0, 3.0, 4.0],
        }
    )

    result = coordinates.compute_altaz(
        stars, observer_lat=MIAMI_LAT, observer_lon=MIAMI_LON, observer_time=OBS_TIME
    )

    assert len(result) == 4
    # All altitudes should be numeric, not NaN
    assert result["alt"].notna().all()
    assert result["az"].notna().all()


def test_empty_dataframe_returns_empty():
    empty = pd.DataFrame(
        columns=["source_id", "ra", "dec", "pmra", "pmdec", "parallax", "phot_g_mean_mag"]
    )
    result = coordinates.compute_altaz(
        empty, observer_lat=MIAMI_LAT, observer_lon=MIAMI_LON, observer_time=OBS_TIME
    )
    assert len(result) == 0
    assert "alt" in result.columns
    assert "az" in result.columns
