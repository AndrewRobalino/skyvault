"""GET /api/v1/constellations — IAU 88 constellations, stick figures, labels.

Phase 3 focus, but the route is scaffolded now so the frontend can stub against it.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/constellations", tags=["constellations"])


@router.get("")
async def get_constellations() -> dict:
    # TODO(phase-3): load IAU stick-figure data from data/constellations.json
    return {"constellations": [], "source": "IAU"}
