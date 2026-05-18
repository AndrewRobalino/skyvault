from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
FIXTURE = Path(__file__).parent / "fixtures" / "naked_eye_dso_minimal.json"


@pytest.fixture(autouse=True)
def use_fixture_catalog():
    """Point the catalog loader at the test fixture for all router tests."""
    with patch("app.services.dso_catalog.settings") as mock_settings:
        mock_settings.dso_catalog_path = FIXTURE
        from app.services.dso_catalog import load_catalog
        load_catalog.cache_clear()
        yield
        load_catalog.cache_clear()


def test_dso_route_nyc_summer():
    r = client.get(
        "/api/v1/dso",
        params={"lat": 40.7128, "lon": -74.0060, "datetime": "2026-08-15T02:00:00Z"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == len(body["dsos"])
    ids = {d["id"] for d in body["dsos"]}
    assert "M31" in ids
    assert "LMC" not in ids  # below NYC horizon


def test_dso_route_invalid_lat():
    r = client.get(
        "/api/v1/dso",
        params={"lat": 999, "lon": 0, "datetime": "2026-08-15T02:00:00Z"},
    )
    assert r.status_code == 422


def test_dso_route_include_below_horizon():
    r = client.get(
        "/api/v1/dso",
        params={
            "lat": 40.7128, "lon": -74.0060,
            "datetime": "2026-08-15T02:00:00Z",
            "include_below_horizon": "true",
        },
    )
    assert r.status_code == 200
    ids = {d["id"] for d in r.json()["dsos"]}
    assert "LMC" in ids
