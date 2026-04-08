"""Smoke tests for the FastAPI app scaffold."""

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "skyvault-api"


def test_sky_route_requires_observer_params():
    # Route is mounted; without required query params it should 422.
    response = client.get("/api/v1/sky")
    assert response.status_code == 422


def test_planets_route_requires_observer_params():
    response = client.get("/api/v1/planets")
    assert response.status_code == 422
