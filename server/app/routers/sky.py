"""GET /api/v1/sky — visible stars for an observer, date, and location.

Pipeline: Gaia catalog magnitude filter -> ICRS->AltAz transform (with J2016.0
proper-motion correction) -> optional below-horizon cull -> Pydantic response.
"""

from __future__ import annotations

import math

import numpy as np
from fastapi import APIRouter, Query

from app.config import settings
from app.models.schemas import Observer, SkyResponse, Star
from app.services import coordinates, star_catalog


router = APIRouter(prefix="/sky", tags=["sky"])


def _safe(value) -> float | None:
    """Convert numpy/pandas numerics to plain floats, mapping NaN -> None.

    Gaia has legitimate nulls for ``parallax``, ``bp_rp``, ``teff_gspphot``,
    etc. Pydantic + JSON don't represent NaN, so we collapse them to None.
    """
    if value is None:
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return f


def _distance_ly(parallax_mas: float | None) -> float | None:
    """Convert Gaia parallax (mas) to distance in light-years."""
    if parallax_mas is None or parallax_mas <= 0:
        return None
    parsecs = 1000.0 / parallax_mas
    return parsecs * 3.2615637769  # pc -> ly


@router.get("", response_model=SkyResponse)
async def get_sky(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Observer latitude (deg)"),
    lon: float = Query(..., ge=-180.0, le=180.0, description="Observer longitude (deg)"),
    datetime: str = Query(..., description="Observation time, ISO 8601 UTC"),
    mag_limit: float = Query(
        settings.default_mag_limit,
        ge=-2.0,
        le=9.0,
        description="Maximum apparent G magnitude to include",
    ),
    include_below_horizon: bool = Query(
        False,
        description="If true, include stars below the horizon in the response.",
    ),
) -> SkyResponse:
    # Magnitude filter first (pure in-memory pandas), then AltAz transform.
    filtered = star_catalog.query_visible_stars(mag_limit=mag_limit)
    with_altaz = coordinates.compute_altaz(
        filtered,
        observer_lat=lat,
        observer_lon=lon,
        observer_time=datetime,
        horizon_only=not include_below_horizon,
    )

    # Vectorized distance conversion — cheaper than calling _distance_ly row by row.
    parallax = with_altaz["parallax"].to_numpy(dtype=float)
    distance_ly = np.where(
        (parallax > 0) & np.isfinite(parallax),
        (1000.0 / np.where(parallax > 0, parallax, 1.0)) * 3.2615637769,
        np.nan,
    )

    stars: list[Star] = [
        Star(
            source_id=str(int(row["source_id"])),
            ra=float(row["ra"]),
            dec=float(row["dec"]),
            alt=float(row["alt"]),
            az=float(row["az"]),
            magnitude=float(row["phot_g_mean_mag"]),
            bp_rp=_safe(row.get("bp_rp")),
            parallax_mas=_safe(row.get("parallax")),
            distance_ly=_safe(distance_ly[i]),
            teff_k=_safe(row.get("teff_gspphot")),
        )
        for i, (_, row) in enumerate(with_altaz.iterrows())
    ]

    return SkyResponse(
        observer=Observer(lat=lat, lon=lon, datetime=datetime),
        stars=stars,
        count=len(stars),
    )
