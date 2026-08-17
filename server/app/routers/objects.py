"""GET /api/v1/objects/{source_id} — baked enrichment lookup for one star.

SIMBAD names/spectral type + NASA Exoplanet Archive host data, served from an
in-memory map (no external calls at runtime).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.schemas import ObjectResponse
from app.services import star_enrichment

router = APIRouter(prefix="/objects", tags=["objects"])


@router.get("/{source_id}", response_model=ObjectResponse)
async def get_object(source_id: str) -> ObjectResponse:
    try:
        enrichment = star_enrichment.enrichment_for(source_id)
    except star_enrichment.StarEnrichmentNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return ObjectResponse(found=enrichment is not None, enrichment=enrichment)
