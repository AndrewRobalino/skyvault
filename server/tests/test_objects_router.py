from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import star_enrichment

FIXTURE = Path(__file__).parent / "fixtures" / "star_enrichment_minimal.json"
client = TestClient(app)


@pytest.fixture(autouse=True)
def use_fixture_catalog(monkeypatch):
    star_enrichment.load_catalog.cache_clear()
    monkeypatch.setattr(star_enrichment.settings, "star_enrichment_path", FIXTURE)
    yield
    star_enrichment.load_catalog.cache_clear()


def test_known_host_star_returns_enrichment():
    r = client.get("/api/v1/objects/2835000000000000000")
    assert r.status_code == 200
    body = r.json()
    assert body["found"] is True
    assert body["enrichment"]["proper_name"] == "51 Pegasi"
    assert body["enrichment"]["planets"]["count"] == 1
    assert "NASA Exoplanet Archive" in body["enrichment"]["sources"]


def test_named_star_without_planets():
    r = client.get("/api/v1/objects/2667000000000000000")
    assert r.status_code == 200
    body = r.json()
    assert body["found"] is True
    assert body["enrichment"]["proper_name"] == "Vega"
    assert body["enrichment"]["planets"] is None
    assert body["enrichment"]["sources"] == ["SIMBAD/CDS"]


def test_unknown_star_returns_found_false():
    r = client.get("/api/v1/objects/9999999999999999999")
    assert r.status_code == 200
    body = r.json()
    assert body["found"] is False
    assert body["enrichment"] is None


def test_missing_catalog_returns_503(monkeypatch):
    star_enrichment.load_catalog.cache_clear()
    monkeypatch.setattr(
        star_enrichment.settings,
        "star_enrichment_path",
        Path("does/not/exist.json"),
    )
    r = client.get("/api/v1/objects/2667000000000000000")
    assert r.status_code == 503
    assert "ingest_star_enrichment" in r.json()["detail"]
