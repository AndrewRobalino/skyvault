"""GET /api/v1/planets — Sun, Moon, Mercury–Neptune for an observer.

Phase 1 stub: populated once ephemeris service lands (DE421 via Astropy).
"""

from fastapi import APIRouter

router = APIRouter(prefix="/planets", tags=["planets"])


@router.get("")
async def get_planets() -> dict:
    # TODO(phase-1): compute AltAz for Sun/Moon/Mercury..Neptune via DE421
    return {"planets": [], "source": "JPL DE421 via Astropy"}
