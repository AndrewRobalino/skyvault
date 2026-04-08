"""GET /api/v1/planets — Sun, Moon, and Mercury-Neptune for an observer."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.models.schemas import Observer, Planet, PlanetsResponse
from app.services import ephemeris


router = APIRouter(prefix="/planets", tags=["planets"])


@router.get("", response_model=PlanetsResponse)
async def get_planets(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Observer latitude (deg)"),
    lon: float = Query(..., ge=-180.0, le=180.0, description="Observer longitude (deg)"),
    datetime: str = Query(..., description="Observation time, ISO 8601 UTC"),
    include_below_horizon: bool = Query(
        False,
        description="If true, include bodies below the horizon in the response.",
    ),
) -> PlanetsResponse:
    results = ephemeris.compute_planet_positions(
        observer_lat=lat,
        observer_lon=lon,
        observer_time=datetime,
        horizon_only=not include_below_horizon,
    )

    planets = [
        Planet(
            name=body["name"],
            alt=body["alt"],
            az=body["az"],
            distance_au=body["distance_au"],
            source=body["source"],
        )
        for body in results
    ]

    return PlanetsResponse(
        observer=Observer(lat=lat, lon=lon, datetime=datetime),
        planets=planets,
        count=len(planets),
    )
