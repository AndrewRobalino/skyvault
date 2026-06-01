"""Constellation stick-figure catalog.

Loads a static JSON file produced by ``scripts/ingest_constellations.py``
(Stellarium Western HIP polylines resolved to ICRS via ESA Hipparcos). At
request time, transforms each segment endpoint and figure-label centroid into
the observer's AltAz frame using Astropy, flagging visibility.

No live VizieR queries from the request path — this stays a cold service.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import numpy as np
from astropy import units as u
from astropy.coordinates import AltAz, EarthLocation, SkyCoord
from astropy.time import Time

from app.config import settings
from app.models.schemas import Constellation, ConstellationSegment


class ConstellationCatalogNotFoundError(FileNotFoundError):
    """Raised when the constellations catalog JSON is missing at load time."""


@lru_cache(maxsize=4)
def load_catalog(path: Path | None = None) -> dict:
    """Load the static constellations catalog JSON. Cached per path."""
    p = Path(path) if path is not None else settings.constellations_catalog_path
    if not p.exists():
        raise ConstellationCatalogNotFoundError(
            f"Constellations catalog not found at {p}. "
            f"Run: cd server && python scripts/ingest_constellations.py"
        )
    with p.open(encoding="utf-8") as fh:
        return json.load(fh)
