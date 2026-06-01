from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import constellation_catalog

client = TestClient(app)
FIXTURE = Path(__file__).parent / "fixtures" / "constellations_minimal.json"


@pytest.fixture(autouse=True)
def use_fixture_catalog(monkeypatch):
    constellation_catalog.load_catalog.cache_clear()
    # Force the service default path to the test fixture.
    monkeypatch.setattr(
        constellation_catalog.settings, "constellations_catalog_path", FIXTURE
    )
    yield
    constellation_catalog.load_catalog.cache_clear()


def test_endpoint_returns_constellations_with_source():
    resp = client.get(
        "/api/v1/constellations",
        params={"lat": 40.7128, "lon": -74.0060, "datetime": "2026-06-01T04:00:00Z"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"]["figures"].startswith("Stellarium")
    assert body["count"] == len(body["constellations"])
    ids = {c["id"] for c in body["constellations"]}
    assert {"Ori", "UMi"} <= ids


def test_endpoint_validates_latitude():
    resp = client.get(
        "/api/v1/constellations",
        params={"lat": 999, "lon": 0, "datetime": "2026-06-01T04:00:00Z"},
    )
    assert resp.status_code == 422
