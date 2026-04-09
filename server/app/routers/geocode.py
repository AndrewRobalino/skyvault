"""GET /api/v1/geocode — Photon proxy for place-name lookup."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.schemas.geocode import GeocodeResponse
from app.services import geocoder


router = APIRouter(prefix="/geocode", tags=["geocode"])


@router.get("", response_model=GeocodeResponse)
async def get_geocode(
    q: str = Query(..., min_length=2, max_length=200, description="Place-name query"),
    limit: int = Query(5, ge=1, le=10, description="Max candidates to return"),
    lang: str = Query(
        "en",
        pattern=r"^[a-z]{2}$",
        description="Language code (2-letter ISO 639-1)",
    ),
) -> GeocodeResponse:
    try:
        return await geocoder.geocode(q, limit=limit, lang=lang)
    except geocoder.GeocoderUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail="Geocoder service temporarily unavailable",
        ) from exc
    except geocoder.GeocoderUpstreamError as exc:
        raise HTTPException(
            status_code=502,
            detail="Geocoder upstream error",
        ) from exc
