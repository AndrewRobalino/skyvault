"""Integration tests for GET /api/v1/planets — real DE421 kernel."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app


pytestmark = pytest.mark.skipif(
    not settings.ephemeris_kernel_path.exists(),
    reason=(
        f"DE421 kernel not found at {settings.ephemeris_kernel_path}. "
        f"Run `python scripts/download_ephemeris.py` first."
    ),
)


client = TestClient(app)

MIAMI = {"lat": 25.7617, "lon": -80.1918, "datetime": "2026-01-15T02:00:00Z"}

EXPECTED_BODIES = {
    "sun", "moon", "mercury", "venus", "mars",
    "jupiter", "saturn", "uranus", "neptune",
}


def test_planets_returns_above_horizon_by_default():
    response = client.get("/api/v1/planets", params=MIAMI)
    assert response.status_code == 200
    body = response.json()

    assert body["count"] == len(body["planets"])
    for planet in body["planets"]:
        assert planet["alt"] >= 0.0
        assert planet["source"] == "JPL DE421 via Astropy"


def test_planets_include_below_horizon_returns_all_nine():
    response = client.get(
        "/api/v1/planets", params={**MIAMI, "include_below_horizon": True}
    )
    body = response.json()
    names = {p["name"] for p in body["planets"]}
    assert names == EXPECTED_BODIES
    assert body["count"] == 9


def test_planets_rejects_bad_longitude():
    bad = client.get(
        "/api/v1/planets",
        params={"lat": 0.0, "lon": 400.0, "datetime": MIAMI["datetime"]},
    )
    assert bad.status_code == 422


def test_planets_every_body_has_required_fields():
    response = client.get(
        "/api/v1/planets", params={**MIAMI, "include_below_horizon": True}
    )
    body = response.json()
    required = {"name", "alt", "az", "distance_au", "source"}
    for planet in body["planets"]:
        assert required <= set(planet.keys())


# Astropy rightly warns that UTC before 1960 / after the IERS tables is
# approximate; that is the point of these inputs.
@pytest.mark.filterwarnings("ignore::erfa.ErfaWarning")
@pytest.mark.filterwarnings("ignore::astropy.utils.exceptions.AstropyWarning")
@pytest.mark.parametrize("when", ["2060-01-01T00:00:00Z", "1850-06-01T00:00:00Z"])
def test_planets_outside_de421_coverage_is_a_clear_422(when):
    # DE421 spans 1899-07-29 .. 2053-10-08. Outside it jplephem raises, which
    # used to surface as a bare 500 the client could only "retry".
    response = client.get("/api/v1/planets", params={**MIAMI, "datetime": when})
    assert response.status_code == 422
    assert "DE421" in response.json()["detail"]


@pytest.mark.filterwarnings("ignore::erfa.ErfaWarning")
@pytest.mark.filterwarnings("ignore::astropy.utils.exceptions.AstropyWarning")
def test_planets_near_the_end_of_de421_coverage_still_work():
    response = client.get(
        "/api/v1/planets", params={**MIAMI, "datetime": "2053-10-01T00:00:00Z"}
    )
    assert response.status_code == 200
