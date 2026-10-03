"""Planet routes run in FastAPI's threadpool. Astropy's
solar_system_ephemeris is process-global state: the context manager restores
whatever was current on entry, so interleaved requests can swap kernels,
serve built-in (non-DE421) positions under the DE421 label, close the shared
SPK under each other, and leave the global stuck."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import pytest
from astropy.coordinates import solar_system_ephemeris

from app.config import settings
from app.services import ephemeris

pytestmark = pytest.mark.skipif(
    not settings.ephemeris_kernel_path.exists(), reason="DE421 kernel not downloaded"
)

TIMES = [f"2026-0{m}-15T02:00:00Z" for m in range(1, 9)]


def _positions(t: str):
    rows = ephemeris.compute_planet_positions(25.76, -80.19, t, horizon_only=False)
    return [(r["name"], round(r["alt"], 9), round(r["az"], 9)) for r in rows]


def test_concurrent_planet_requests_match_serial_and_leave_state_alone():
    before = solar_system_ephemeris.get()
    serial = {t: _positions(t) for t in TIMES}
    jobs = TIMES * 5  # 40 calls
    with ThreadPoolExecutor(max_workers=10) as pool:
        results = list(pool.map(_positions, jobs))
    for t, got in zip(jobs, results):
        assert got == serial[t], f"concurrent result for {t} differs from serial"
    assert solar_system_ephemeris.get() == before
