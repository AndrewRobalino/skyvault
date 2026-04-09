"""Pydantic schemas for the /api/v1/geocode endpoint.

Wraps Photon's GeoJSON FeatureCollection response in a smaller,
frontend-friendly shape. Every candidate carries the ``source`` string so
the UI can render the attribution badge.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class GeocodeCandidate(BaseModel):
    display_name: str = Field(..., description="Human-readable, e.g. 'Portoviejo, Manabí, Ecuador'")
    name: str = Field(..., description="Short place name, e.g. 'Portoviejo'")
    country: str | None = None
    state: str | None = None
    lat: float = Field(..., ge=-90.0, le=90.0)
    lon: float = Field(..., ge=-180.0, le=180.0)
    osm_type: str | None = None
    osm_id: str | None = None
    place_type: str | None = None


class GeocodeResponse(BaseModel):
    query: str
    candidates: list[GeocodeCandidate]
    count: int
    source: str = "Photon (photon.komoot.io) / OpenStreetMap"
