"""Pydantic request/response schemas for the SkyVault API.

TODO(phase-1): flesh out Observer, Star, Planet, SkyResponse, PlanetResponse.
Kept as stubs so routers can import symbols without breaking on empty modules.
"""

from pydantic import BaseModel


class Observer(BaseModel):
    lat: float
    lon: float
    datetime: str  # ISO 8601 UTC
