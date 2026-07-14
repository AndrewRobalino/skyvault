"""GET /api/v1/dso — naked-eye deep-sky objects for an observer."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import DsoResponse, Observer
from app.services import dso_catalog
from app.services.time_utils import InvalidObservationTimeError


router = APIRouter(prefix="/dso", tags=["dso"])


@router.get("", response_model=DsoResponse)
async def get_dsos(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Observer latitude (deg)"),
    lon: float = Query(..., ge=-180.0, le=180.0, description="Observer longitude (deg)"),
    datetime: str = Query(..., description="Observation time, ISO 8601 UTC"),
    include_below_horizon: bool = Query(
        False,
        description="If true, include objects below the horizon in the response.",
    ),
) -> DsoResponse:
    try:
        dsos = dso_catalog.dsos_for_observer(
            lat=lat,
            lon=lon,
            time_utc=datetime,
            horizon_only=not include_below_horizon,
        )
    except InvalidObservationTimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except dso_catalog.DsoCatalogNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return DsoResponse(
        observer=Observer(lat=lat, lon=lon, datetime=datetime),
        dsos=dsos,
        count=len(dsos),
    )
