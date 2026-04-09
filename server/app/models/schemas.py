"""Pydantic request/response schemas for the SkyVault API.

Every astronomical object returned by the API carries a ``source`` field
identifying the institutional dataset it came from — that's a product
requirement, not a nice-to-have.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class Observer(BaseModel):
    """Observer location + time echoed back to the client."""

    lat: float = Field(..., ge=-90.0, le=90.0, description="Latitude in degrees")
    lon: float = Field(..., ge=-180.0, le=180.0, description="Longitude in degrees")
    datetime: str = Field(..., description="Observation time (ISO 8601 UTC)")


class Star(BaseModel):
    """A single star in the rendered sky.

    Alt/Az are in the observer's local horizontal frame. RA/Dec are the
    original ICRS positions from Gaia (epoch J2016.0); proper-motion-corrected
    positions live implicitly in alt/az.
    """

    source_id: int
    ra: float
    dec: float
    alt: float
    az: float
    magnitude: float
    bp_rp: float | None = None
    parallax_mas: float | None = None
    distance_ly: float | None = None
    teff_k: float | None = None
    source: str = "Gaia DR3"


class SkyResponse(BaseModel):
    observer: Observer
    stars: list[Star]
    count: int


class Planet(BaseModel):
    """A single solar system body in the observer's sky.

    ``phase_angle``, ``illumination``, and ``phase_name`` are populated only
    for the Moon. They're ``None`` for every other body (the Sun has no phase
    against itself; the naked-eye planets have phases but they're tiny and
    not useful at v1's visual fidelity).
    """

    name: str
    alt: float
    az: float
    distance_au: float
    phase_angle: float | None = None        # degrees; 0 = full moon, 180 = new moon
    illumination: float | None = None       # [0, 1] fraction illuminated
    phase_name: str | None = None           # e.g. "waxing crescent"
    source: str = "JPL DE421 via Astropy"


class PlanetsResponse(BaseModel):
    observer: Observer
    planets: list[Planet]
    count: int
