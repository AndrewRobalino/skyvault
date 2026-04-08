"""GET /api/v1/sky — visible stars for an observer, date, and location.

Phase 1 stub: route wired up, returns empty payload until star_catalog + coordinates
services land.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/sky", tags=["sky"])


@router.get("")
async def get_sky() -> dict:
    # TODO(phase-1): wire up query_visible_stars + AltAz transform
    return {"stars": [], "count": 0, "source": "Gaia DR3"}
