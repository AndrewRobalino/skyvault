"""Integration tests for the /api/v1/geocode endpoint.

These tests hit the FastAPI router via TestClient but mock the underlying
geocoder service (no real network calls).
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.geocode import GeocodeCandidate, GeocodeResponse
from app.services import geocoder


client = TestClient(app)


@pytest.fixture
def sample_response():
    return GeocodeResponse(
        query="Portoviejo",
        candidates=[
            GeocodeCandidate(
                display_name="Portoviejo, Manabí, Ecuador",
                name="Portoviejo",
                country="Ecuador",
                state="Manabí",
                lat=-1.0569,
                lon=-80.4544,
                osm_type="N",
                osm_id="123456789",
                place_type="city",
            )
        ],
        count=1,
    )


def test_geocode_returns_200(sample_response):
    with patch("app.routers.geocode.geocoder.geocode", AsyncMock(return_value=sample_response)):
        resp = client.get("/api/v1/geocode?q=Portoviejo")
    assert resp.status_code == 200
    body = resp.json()
    assert body["query"] == "Portoviejo"
    assert body["count"] == 1
    assert body["candidates"][0]["country"] == "Ecuador"
    assert body["source"].startswith("Photon")


def test_geocode_q_too_short_returns_422():
    resp = client.get("/api/v1/geocode?q=a")
    assert resp.status_code == 422


def test_geocode_q_too_long_returns_422():
    long_q = "x" * 201
    resp = client.get(f"/api/v1/geocode?q={long_q}")
    assert resp.status_code == 422


def test_geocode_limit_out_of_range_returns_422():
    resp = client.get("/api/v1/geocode?q=Miami&limit=99")
    assert resp.status_code == 422


def test_geocode_lang_bad_format_returns_422():
    resp = client.get("/api/v1/geocode?q=Miami&lang=English")
    assert resp.status_code == 422


def test_geocode_upstream_timeout_returns_503():
    with patch(
        "app.routers.geocode.geocoder.geocode",
        AsyncMock(side_effect=geocoder.GeocoderUnavailableError("timeout")),
    ):
        resp = client.get("/api/v1/geocode?q=Portoviejo")
    assert resp.status_code == 503
    assert "temporarily unavailable" in resp.json()["detail"].lower()


def test_geocode_upstream_5xx_returns_502():
    with patch(
        "app.routers.geocode.geocoder.geocode",
        AsyncMock(side_effect=geocoder.GeocoderUpstreamError("503 from photon")),
    ):
        resp = client.get("/api/v1/geocode?q=Portoviejo")
    assert resp.status_code == 502
    assert "upstream" in resp.json()["detail"].lower()
