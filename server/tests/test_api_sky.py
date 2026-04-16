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
        assert star["source"] == "Gaia DR3"


def test_sky_include_below_horizon_returns_more_stars():
    above = client.get(
        "/api/v1/sky", params={**MIAMI, "mag_limit": 6.5}
    ).json()["count"]
    full = client.get(
        "/api/v1/sky",
        params={**MIAMI, "mag_limit": 6.5, "include_below_horizon": True},
    ).json()["count"]

    # Roughly half the sky is always below horizon, so the full-sky count
    # should be strictly larger.
    assert full > above
    # And the ratio should be reasonable — not 10x, not 1.01x.
    assert 1.5 < full / above < 3.0


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
        assert star["source_id"].isdigit()
