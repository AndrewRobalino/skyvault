"""Acceptance tests that hit real Photon — gated behind the 'network' mark.

Run with: pytest -m network

These tests verify global coverage across three real-world cases:
  - Miami, Florida (US city)
  - Charlotte, North Carolina (US city, different state)
  - Portoviejo, Ecuador (small South American city)
"""

from __future__ import annotations

import pytest

from app.services import geocoder


pytestmark = pytest.mark.network


@pytest.fixture(autouse=True)
async def close_shared_client():
    """Never let the pooled client outlive the event loop that created it.

    ``geocoder._client`` is module-level state (see ``_get_client``). pytest-asyncio
    gives each test its own event loop, so a client left behind by one test carries
    pooled connections bound to a loop that is already closed — the next test to
    reuse it dies with ``RuntimeError: Event loop is closed``. Closing it here, inside
    the same loop that opened it, keeps each test independent.
    """
    yield
    await geocoder.close_client()


@pytest.mark.asyncio
async def test_real_geocode_miami_florida():
    result = await geocoder.geocode("Miami, FL", limit=5, lang="en")
    assert result.count >= 1
    countries = {c.country for c in result.candidates if c.country}
    assert "United States" in countries


@pytest.mark.asyncio
async def test_real_geocode_charlotte_north_carolina():
    result = await geocoder.geocode("Charlotte, NC", limit=5, lang="en")
    assert result.count >= 1
    found_nc = any(
        c.state and "Carolina" in c.state and c.country == "United States"
        for c in result.candidates
    )
    assert found_nc, f"No Charlotte NC in candidates: {[c.display_name for c in result.candidates]}"


@pytest.mark.asyncio
async def test_real_geocode_portoviejo_ecuador():
    result = await geocoder.geocode("Portoviejo", limit=5, lang="en")
    assert result.count >= 1
    countries = {c.country for c in result.candidates if c.country}
    assert "Ecuador" in countries
