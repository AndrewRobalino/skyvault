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

from app.config import settings
from app.models.schemas import Constellation, ConstellationSegment
from app.services.time_utils import parse_utc_time


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


def constellations_for_observer(
    lat: float,
    lon: float,
    time_utc: str,
    catalog_path: Path | None = None,
) -> list[Constellation]:
    """Return constellations with AltAz-transformed segments + labels.

    A segment is ``visible`` only when both endpoints are above the horizon.
    A label is visible only when its centroid is above the horizon. Nothing is
    dropped from the response — visibility is flagged so the client can choose.
    """
    data = load_catalog(catalog_path)
    raw = data.get("constellations", [])
    if not raw:
        return []

    location = EarthLocation(lat=lat * u.deg, lon=lon * u.deg)
    time = parse_utc_time(time_utc)
    frame = AltAz(obstime=time, location=location)

    # Flatten every endpoint + every label into one SkyCoord for a single
    # vectorized transform, then scatter results back by index.
    ras: list[float] = []
    decs: list[float] = []
    for c in raw:
        for seg in c["segments"]:
            ras.extend([seg["from"][0], seg["to"][0]])
            decs.extend([seg["from"][1], seg["to"][1]])
        ras.append(c["label"][0])
        decs.append(c["label"][1])

    coords = SkyCoord(ra=np.array(ras) * u.deg, dec=np.array(decs) * u.deg, frame="icrs")
    altaz = coords.transform_to(frame)
    alts = altaz.alt.deg
    azs = altaz.az.deg

    out: list[Constellation] = []
    idx = 0
    for c in raw:
        segments: list[ConstellationSegment] = []
        for _seg in c["segments"]:
            f_alt, f_az = float(alts[idx]), float(azs[idx])
            t_alt, t_az = float(alts[idx + 1]), float(azs[idx + 1])
            idx += 2
            segments.append(
                ConstellationSegment(
                    from_alt=f_alt,
                    from_az=f_az,
                    to_alt=t_alt,
                    to_az=t_az,
                    visible=(f_alt >= 0 and t_alt >= 0),
                )
            )
        label_alt, label_az = float(alts[idx]), float(azs[idx])
        idx += 1
        out.append(
            Constellation(
                id=c["id"],
                name=c["name"],
                segments=segments,
                label_alt=label_alt,
                label_az=label_az,
                label_visible=label_alt >= 0,
            )
        )
    return out
