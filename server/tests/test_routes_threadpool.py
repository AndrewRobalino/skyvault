"""CPU-bound routes must be plain ``def`` so FastAPI runs them in its threadpool.

An ``async def`` route that does 100-200 ms of Astropy work blocks the event
loop: measured /health at 869 ms (vs 2 ms idle) while six /sky requests ran.
On a single-worker deploy that stalls health checks, geocoding and star clicks
behind every sky computation.
"""

from __future__ import annotations

import inspect

import pytest

from app.routers import constellations, dso, planets, sky


@pytest.mark.parametrize(
    "handler",
    [sky.get_sky, planets.get_planets, dso.get_dsos, constellations.get_constellations],
)
def test_cpu_bound_route_is_not_a_coroutine(handler):
    assert not inspect.iscoroutinefunction(handler)
