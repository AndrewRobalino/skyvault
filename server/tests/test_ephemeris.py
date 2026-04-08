"""Tests for the JPL DE421 planet ephemeris service.

Assertions here are physics identities, not fabricated reference values —
we never hardcode "expected" numbers that we didn't derive from first
principles or pull from a cited source.
"""

from __future__ import annotations

import pytest

from app.config import settings
from app.services import ephemeris


pytestmark = pytest.mark.skipif(
    not settings.ephemeris_kernel_path.exists(),
    reason=(
        f"DE421 kernel not found at {settings.ephemeris_kernel_path}. "
        f"Run `python scripts/download_ephemeris.py` first."
    ),
)


MIAMI_LAT = 25.7617
MIAMI_LON = -80.1918

EXPECTED_BODIES = {
    "sun",
    "moon",
    "mercury",
    "venus",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
}


def _by_name(results: list[dict]) -> dict[str, dict]:
    return {body["name"]: body for body in results}


def test_returns_all_nine_bodies():
    results = ephemeris.compute_planet_positions(
        observer_lat=MIAMI_LAT,
        observer_lon=MIAMI_LON,
        observer_time="2026-01-15T02:00:00Z",
    )
    names = {body["name"] for body in results}
    assert names == EXPECTED_BODIES


def test_every_body_has_valid_altaz_and_source():
    results = ephemeris.compute_planet_positions(
        observer_lat=MIAMI_LAT,
        observer_lon=MIAMI_LON,
        observer_time="2026-01-15T02:00:00Z",
    )
    for body in results:
        assert -90.0 <= body["alt"] <= 90.0, f"{body['name']} alt out of range"
        assert 0.0 <= body["az"] <= 360.0, f"{body['name']} az out of range"
        assert body["distance_au"] > 0
        assert body["source"] == "JPL DE421 via Astropy"


def test_sun_altitude_at_equinox_noon_equals_90_minus_latitude():
    """Physics identity: at the spring equinox, the Sun's altitude at local
    solar noon from latitude φ is ``90° - |φ|`` (Sun on celestial equator,
    observer's meridian).

    Miami sits at longitude -80.19°, so local solar noon is approximately
    ``12:00 + 80.19/15 h UTC`` ≈ 17:20 UTC. We use 2026-03-20 17:20 UTC as a
    close approximation — tolerance of 2° absorbs the equation-of-time
    wobble and the fact that the true equinox isn't exactly at that moment.
    """
    results = ephemeris.compute_planet_positions(
        observer_lat=MIAMI_LAT,
        observer_lon=MIAMI_LON,
        observer_time="2026-03-20T17:20:00Z",
    )
    sun = _by_name(results)["sun"]
    expected_max_alt = 90.0 - MIAMI_LAT  # ≈ 64.24°
    assert abs(sun["alt"] - expected_max_alt) < 2.0, (
        f"Sun alt {sun['alt']:.3f}° should be near {expected_max_alt:.3f}° "
        f"at Miami solar noon on the equinox"
    )


def test_moon_distance_in_expected_range():
    """The Moon orbits Earth at ~0.0024-0.0027 AU (~60 Earth radii).

    Any value outside ~0.002-0.003 AU means the frame is wrong — e.g. we
    accidentally returned the Moon's heliocentric distance.
    """
    results = ephemeris.compute_planet_positions(
        observer_lat=MIAMI_LAT,
        observer_lon=MIAMI_LON,
        observer_time="2026-01-15T02:00:00Z",
    )
    moon = _by_name(results)["moon"]
    assert 0.002 < moon["distance_au"] < 0.003, (
        f"Moon distance {moon['distance_au']:.6f} AU is way outside expected "
        f"~0.0024-0.0027 AU — frame is probably wrong"
    )


def test_outer_planets_distance_bounds():
    """Sanity: Jupiter ≥ 4 AU, Neptune ≥ 28 AU always. If these fail, we're
    returning heliocentric instead of geocentric distances, or worse.
    """
    results = ephemeris.compute_planet_positions(
        observer_lat=MIAMI_LAT,
        observer_lon=MIAMI_LON,
        observer_time="2026-01-15T02:00:00Z",
    )
    by_name = _by_name(results)
    assert by_name["jupiter"]["distance_au"] >= 4.0
    assert by_name["neptune"]["distance_au"] >= 28.0


def test_horizon_only_filter_removes_below_horizon_bodies():
    """At some instant, at least one body is below the horizon — the filter
    must drop it from the results."""
    full = ephemeris.compute_planet_positions(
        observer_lat=MIAMI_LAT,
        observer_lon=MIAMI_LON,
        observer_time="2026-01-15T02:00:00Z",
    )
    visible = ephemeris.compute_planet_positions(
        observer_lat=MIAMI_LAT,
        observer_lon=MIAMI_LON,
        observer_time="2026-01-15T02:00:00Z",
        horizon_only=True,
    )
    assert len(visible) <= len(full)
    assert all(body["alt"] >= 0 for body in visible)
