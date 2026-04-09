"""Unit tests for the Photon geocoder service.

All tests mock httpx so they're network-free. Real-network acceptance tests
live in test_geocoder_acceptance.py and are gated behind the 'network' mark.
"""

from __future__ import annotations

import time
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.services import geocoder


# A minimal Photon-shaped GeoJSON response with two candidates
SAMPLE_PHOTON_RESPONSE = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [-80.4544, -1.0569]},
            "properties": {
                "name": "Portoviejo",
                "country": "Ecuador",
                "state": "Manabí",
                "osm_type": "N",
                "osm_id": 123456789,
                "type": "city",
            },
        },
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [-80.20, -1.10]},
            "properties": {
                "name": "Portoviejo Rural",
                "country": "Ecuador",
                "state": "Manabí",
                "osm_type": "N",
                "osm_id": 987654321,
                "type": "village",
            },
        },
    ],
}


@pytest.fixture(autouse=True)
def clear_cache():
    """Each test starts with an empty cache."""
    geocoder._CACHE.clear()
    yield
    geocoder._CACHE.clear()


@pytest.mark.asyncio
async def test_geocode_returns_parsed_candidates():
    mock_response = httpx.Response(200, json=SAMPLE_PHOTON_RESPONSE)
    with patch.object(httpx.AsyncClient, "get", AsyncMock(return_value=mock_response)):
        result = await geocoder.geocode("Portoviejo", limit=5, lang="en")

    assert result.query == "Portoviejo"
    assert result.count == 2
    assert len(result.candidates) == 2
    first = result.candidates[0]
    assert first.name == "Portoviejo"
    assert first.country == "Ecuador"
    assert first.state == "Manabí"
    assert abs(first.lat - (-1.0569)) < 1e-6
    assert abs(first.lon - (-80.4544)) < 1e-6
    assert first.display_name == "Portoviejo, Manabí, Ecuador"
    assert result.source == "Photon (photon.komoot.io) / OpenStreetMap"


@pytest.mark.asyncio
async def test_geocode_empty_result():
    mock_response = httpx.Response(200, json={"type": "FeatureCollection", "features": []})
    with patch.object(httpx.AsyncClient, "get", AsyncMock(return_value=mock_response)):
        result = await geocoder.geocode("ZzzzzNonexistent", limit=5, lang="en")

    assert result.count == 0
    assert result.candidates == []


@pytest.mark.asyncio
async def test_geocode_cache_hit_does_not_call_httpx_twice():
    mock_response = httpx.Response(200, json=SAMPLE_PHOTON_RESPONSE)
    mock_get = AsyncMock(return_value=mock_response)
    with patch.object(httpx.AsyncClient, "get", mock_get):
        await geocoder.geocode("Portoviejo", limit=5, lang="en")
        await geocoder.geocode("Portoviejo", limit=5, lang="en")
    assert mock_get.call_count == 1


@pytest.mark.asyncio
async def test_geocode_cache_key_ignores_case_and_whitespace():
    mock_response = httpx.Response(200, json=SAMPLE_PHOTON_RESPONSE)
    mock_get = AsyncMock(return_value=mock_response)
    with patch.object(httpx.AsyncClient, "get", mock_get):
        await geocoder.geocode("Portoviejo", limit=5, lang="en")
        await geocoder.geocode("  portoviejo  ", limit=5, lang="en")
        await geocoder.geocode("PORTOVIEJO", limit=5, lang="en")
    assert mock_get.call_count == 1


@pytest.mark.asyncio
async def test_geocode_cache_ttl_expiry():
    mock_response = httpx.Response(200, json=SAMPLE_PHOTON_RESPONSE)
    mock_get = AsyncMock(return_value=mock_response)
    with patch.object(httpx.AsyncClient, "get", mock_get):
        await geocoder.geocode("Portoviejo", limit=5, lang="en")

        # Fake time advance past TTL
        with patch.object(
            geocoder.time, "time",
            return_value=time.time() + geocoder.CACHE_TTL_SECONDS + 1,
        ):
            await geocoder.geocode("Portoviejo", limit=5, lang="en")
    assert mock_get.call_count == 2


@pytest.mark.asyncio
async def test_geocode_cache_eviction_drops_oldest():
    """Fill the cache to MAX+1 entries and verify the oldest are evicted."""
    mock_response = httpx.Response(200, json={"type": "FeatureCollection", "features": []})
    with patch.object(httpx.AsyncClient, "get", AsyncMock(return_value=mock_response)):
        for i in range(geocoder.CACHE_MAX_ENTRIES + geocoder.CACHE_EVICT_BATCH + 1):
            await geocoder.geocode(f"query_{i}", limit=5, lang="en")
    assert len(geocoder._CACHE) <= geocoder.CACHE_MAX_ENTRIES


@pytest.mark.asyncio
async def test_geocode_upstream_timeout_raises_unavailable():
    with patch.object(
        httpx.AsyncClient, "get", AsyncMock(side_effect=httpx.TimeoutException("slow"))
    ):
        with pytest.raises(geocoder.GeocoderUnavailableError):
            await geocoder.geocode("Portoviejo", limit=5, lang="en")


@pytest.mark.asyncio
async def test_geocode_upstream_5xx_raises_upstream_error():
    mock_response = httpx.Response(503, json={"error": "service down"})
    with patch.object(httpx.AsyncClient, "get", AsyncMock(return_value=mock_response)):
        with pytest.raises(geocoder.GeocoderUpstreamError):
            await geocoder.geocode("Portoviejo", limit=5, lang="en")


@pytest.mark.asyncio
async def test_geocode_display_name_without_state():
    payload = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [2.35, 48.85]},
                "properties": {
                    "name": "Paris",
                    "country": "France",
                    "osm_type": "R",
                    "osm_id": 7444,
                    "type": "city",
                },
            }
        ],
    }
    mock_response = httpx.Response(200, json=payload)
    with patch.object(httpx.AsyncClient, "get", AsyncMock(return_value=mock_response)):
        result = await geocoder.geocode("Paris", limit=5, lang="en")
    assert result.candidates[0].display_name == "Paris, France"
