"""Integration tests for GET /api/v1/sky — real Gaia parquet, real Astropy."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app


pytestmark = pytest.mark.skipif(
    not settings.gaia_parquet_path.exists(),
    reason=(
        f"Gaia parquet not found at {settings.gaia_parquet_path}. "
        f"Run `python scripts/ingest_gaia.py` first."
    ),
)


client = TestClient(app)


MIAMI = {"lat": 25.7617, "lon": -80.1918, "datetime": "2026-01-15T02:00:00Z"}


def test_sky_returns_stars_above_horizon_only_by_default():
    response = client.get("/api/v1/sky", params={**MIAMI, "mag_limit": 6.5})
    assert response.status_code == 200
    body = response.json()

    assert body["count"] > 0
    assert body["count"] == len(body["stars"])
    assert body["observer"]["lat"] == MIAMI["lat"]

    # Default is horizon_only=True → every star should be above the horizon.
    for star in body["stars"]:
        assert star["alt"] >= 0.0, f"star {star['source_id']} below horizon"
        assert 0.0 <= star["az"] <= 360.0
        assert star["source"] in {"Gaia DR3", "ESA Hipparcos"}


def test_sky_never_returns_below_horizon_stars():
    # The chart only draws the visible hemisphere. A full-sphere response is
    # ~2x the payload for nothing, so the option is not offered.
    body = client.get(
        "/api/v1/sky",
        params={**MIAMI, "mag_limit": 6.5, "include_below_horizon": True},
    ).json()
    assert body["count"] > 0
    assert all(star["alt"] >= 0.0 for star in body["stars"])


def test_sky_rejects_mag_limit_fainter_than_naked_eye():
    # mag 9 + full sky was a 58 MB, ~770 MiB-peak request: enough to OOM a
    # 512 MiB container with one unauthenticated GET.
    response = client.get("/api/v1/sky", params={**MIAMI, "mag_limit": 9.0})
    assert response.status_code == 422


def test_sky_mag_limit_reduces_star_count():
    bright = client.get(
        "/api/v1/sky", params={**MIAMI, "mag_limit": 3.0}
    ).json()["count"]
    dim = client.get(
        "/api/v1/sky", params={**MIAMI, "mag_limit": 6.5}
    ).json()["count"]
    assert bright < dim


def test_sky_rejects_invalid_latitude():
    response = client.get(
        "/api/v1/sky", params={"lat": 200.0, "lon": 0.0, "datetime": MIAMI["datetime"]}
    )
    assert response.status_code == 422


def test_sky_every_star_has_required_fields_with_source():
    response = client.get("/api/v1/sky", params={**MIAMI, "mag_limit": 4.0})
    body = response.json()
    assert body["count"] > 0

    required = {"source_id", "ra", "dec", "alt", "az", "magnitude", "source"}
    for star in body["stars"]:
        missing = required - set(star.keys())
        assert not missing, f"star missing fields: {missing}"


def test_sky_source_id_serialized_as_string():
    # Gaia DR3 source_ids are 64-bit ints (~10^18) that exceed JS
    # Number.MAX_SAFE_INTEGER. They must cross the API as strings so the
    # frontend doesn't silently lose precision.
    response = client.get("/api/v1/sky", params={**MIAMI, "mag_limit": 4.0})
    body = response.json()
    assert body["count"] > 0
    for star in body["stars"]:
        assert isinstance(star["source_id"], str)
        # Gaia ids are all digits; Hipparcos supplement ids are "hip:<n>".
        if star["source"] == "Gaia DR3":
            assert star["source_id"].isdigit()
        else:
            assert star["source_id"].startswith("hip:")


def test_sky_includes_the_bright_stars_gaia_saturates_on():
    # Gaia DR3 has no stars brighter than G = 1.73. Sirius (HIP 32349) and
    # Rigel (HIP 24436) are both up over Miami at this time and must come from
    # the Hipparcos supplement, labelled as such.
    body = client.get("/api/v1/sky", params={**MIAMI, "mag_limit": 6.5}).json()
    by_id = {s["source_id"]: s for s in body["stars"]}
    for hip in ("hip:32349", "hip:24436"):
        assert hip in by_id, f"{hip} missing from /sky"
        assert by_id[hip]["source"] == "ESA Hipparcos"
        assert "Riello" in by_id[hip]["magnitude_source"]
    assert by_id["hip:32349"]["magnitude"] == min(s["magnitude"] for s in body["stars"])


def _decimals(x: float) -> int:
    s = repr(float(x))
    return len(s.split(".")[1]) if "." in s and "e" not in s else 0


def test_sky_numbers_are_rounded_for_transport():
    # 0.00001 deg = 0.04": far below the pipeline's real error budget (no
    # refraction alone is ~0.5 deg). Cuts the payload with no visible change.
    body = client.get("/api/v1/sky", params={**MIAMI, "mag_limit": 6.5}).json()
    for star in body["stars"][:200]:
        for key in ("ra", "dec", "alt", "az"):
            assert _decimals(star[key]) <= 5, (key, star[key])
        assert _decimals(star["magnitude"]) <= 3
        if star["distance_ly"] is not None:
            assert _decimals(star["distance_ly"]) <= 2


def test_sky_response_is_gzipped():
    response = client.get(
        "/api/v1/sky", params={**MIAMI, "mag_limit": 6.5}, headers={"Accept-Encoding": "gzip"}
    )
    assert response.headers.get("content-encoding") == "gzip"
