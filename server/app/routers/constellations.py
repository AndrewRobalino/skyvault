"""GET /api/v1/constellations — Western stick-figure constellations for an observer.

Source: Stellarium Western sky culture (figures, CC BY-SA) + ESA Hipparcos
(coordinates) + IAU (names). See scripts/ingest_constellations.py.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import ConstellationsResponse, Observer
from app.services import constellation_catalog
from app.services.time_utils import InvalidObservationTimeError

router = APIRouter(prefix="/constellations", tags=["constellations"])


@router.get("", response_model=ConstellationsResponse)
async def get_constellations(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Observer latitude (deg)"),
    lon: float = Query(..., ge=-180.0, le=180.0, description="Observer longitude (deg)"),
    datetime: str = Query(..., description="Observation time, ISO 8601 UTC"),
) -> ConstellationsResponse:
    try:
        data = constellation_catalog.load_catalog()
    except constellation_catalog.ConstellationCatalogNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    try:
        constellations = constellation_catalog.constellations_for_observer(
            lat=lat, lon=lon, time_utc=datetime
        )
    except InvalidObservationTimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return ConstellationsResponse(
        observer=Observer(lat=lat, lon=lon, datetime=datetime),
        constellations=constellations,
        count=len(constellations),
        source=data["source"],
    )
