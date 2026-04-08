"""GET /api/v1/objects/{id} — enrichment lookup for a single object.

Phase 3+: SIMBAD metadata + NASA Exoplanet Archive host-star data.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/objects", tags=["objects"])


@router.get("/{object_id}")
async def get_object(object_id: str) -> dict:
    # TODO(phase-3): SIMBAD + NASA Exoplanet Archive lookup, cached
    return {"id": object_id, "enrichment": None, "sources": []}
