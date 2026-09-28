"""Pydantic request/response schemas for the SkyVault API.

Every astronomical object returned by the API carries a ``source`` field
identifying the institutional dataset it came from — that's a product
requirement, not a nice-to-have.
"""

from __future__ import annotations

from typing import Literal

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

    # Gaia DR3 source_ids are 64-bit integers up to ~10^18, which exceed
    # JavaScript's Number.MAX_SAFE_INTEGER (2^53 - 1). Serialize as string
    # so frontend JSON.parse doesn't silently corrupt the last few digits.
    source_id: str
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


class DeepSkyObject(BaseModel):
    """A naked-eye deep-sky object (galaxy, nebula, or star cluster).

    Positions are computed in the observer's AltAz frame at the request time.
    RA/Dec are the catalog ICRS coordinates from SIMBAD. Angular sizes are
    major-axis arcminutes (and minor-axis for elongated objects like M31).
    Position angle is degrees east of north for the major axis.
    """

    id: str
    common_name: str
    messier_id: str | None = None
    type: Literal["galaxy", "nebula", "open_cluster", "globular_cluster"]
    ra: float = Field(..., ge=0.0, lt=360.0, description="ICRS right ascension in degrees")
    dec: float = Field(..., ge=-90.0, le=90.0, description="ICRS declination in degrees")
    alt: float
    az: float
    magnitude: float = Field(..., description="Apparent visual magnitude (Johnson V)")
    angular_size_arcmin: float = Field(..., gt=0.0, description="Major-axis angular size in arcminutes")
    minor_axis_arcmin: float | None = None
    position_angle_deg: float | None = None
    source: str = "SIMBAD/CDS"


class DsoResponse(BaseModel):
    observer: Observer
    dsos: list[DeepSkyObject]
    count: int


class ConstellationSegment(BaseModel):
    """One stick-figure line segment in the observer's AltAz frame.

    ``visible`` is True only when BOTH endpoints are above the horizon.
    Segments with an endpoint below the horizon are still returned with
    ``visible=False`` — the client decides whether to draw them.
    """

    from_alt: float
    from_az: float
    to_alt: float
    to_az: float
    visible: bool


class Constellation(BaseModel):
    """A single constellation: its stick-figure segments + a name label.

    ``id`` is the IAU abbreviation (e.g. "Ori"); ``name`` is the English
    common name (e.g. "Orion"). The label sits at the figure's centroid;
    ``label_visible`` is True only when the centroid is above the horizon.
    """

    id: str
    name: str
    segments: list[ConstellationSegment]
    label_alt: float
    label_az: float
    label_visible: bool


class ConstellationsResponse(BaseModel):
    observer: Observer
    constellations: list[Constellation]
    count: int
    source: dict[str, str]


class ExoplanetInfo(BaseModel):
    """Confirmed exoplanets for a host star (NASA Exoplanet Archive)."""

    count: int = Field(..., ge=0, description="Number of confirmed planets")
    names: list[str] = Field(default_factory=list, description="Planet designations")


class ObjectEnrichment(BaseModel):
    """SIMBAD + NASA Exoplanet Archive enrichment for one star.

    Every field except ``source_id`` may be missing — enrichment coverage is
    partial and honest. ``planets`` is present only for confirmed hosts.
    """

    source_id: str
    proper_name: str | None = None
    designation: str | None = None
    catalog_ids: list[str] = Field(default_factory=list)
    spectral_type: str | None = None
    object_type: str | None = None
    planets: ExoplanetInfo | None = None
    sources: list[str] = Field(default_factory=list)


class ObjectResponse(BaseModel):
    """Enrichment lookup response. ``found`` is False for stars with no entry."""

    found: bool
    enrichment: ObjectEnrichment | None = None
