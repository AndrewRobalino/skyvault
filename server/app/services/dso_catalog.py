"""Naked-eye deep-sky object catalog.

Loads a static JSON file produced by ``scripts/ingest_dso.py`` (a one-time
SIMBAD pull). At request time, transforms each object's catalog ICRS position
into the observer's AltAz frame using Astropy, and optionally filters to
objects above the horizon.

No live SIMBAD queries from the request path — this stays a cold service.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from astropy import units as u
from astropy.coordinates import AltAz, EarthLocation, SkyCoord
from astropy.time import Time

from app.config import settings
from app.models.schemas import DeepSkyObject


class DsoCatalogNotFoundError(FileNotFoundError):
    """Raised when the DSO catalog JSON is missing at load time."""


@lru_cache(maxsize=4)
def load_catalog(path: Path | None = None) -> list[dict]:
    """Load the static DSO catalog JSON. Cached per path."""
    p = Path(path) if path is not None else settings.dso_catalog_path
    if not p.exists():
        raise DsoCatalogNotFoundError(
            f"DSO catalog not found at {p}. "
            f"Run: cd server && python scripts/ingest_dso.py"
        )
    with p.open(encoding="utf-8") as fh:
        return json.load(fh)


def dsos_for_observer(
    lat: float,
    lon: float,
    time_utc: str,
    catalog_path: Path | None = None,
    horizon_only: bool = True,
) -> list[DeepSkyObject]:
    """Return DSOs with computed AltAz for the given observer + time.

    Args:
        lat: observer latitude (deg, +N).
        lon: observer longitude (deg, +E).
        time_utc: ISO 8601 UTC observation time.
        catalog_path: override default catalog path (used by tests).
        horizon_only: if True, drop objects below the horizon.

    Returns:
        List of DeepSkyObject sorted by ascending RA.
    """
    raw = load_catalog(catalog_path)
    if not raw:
        return []

    location = EarthLocation(lat=lat * u.deg, lon=lon * u.deg)
    time = Time(time_utc.replace("Z", ""), scale="utc")
    frame = AltAz(obstime=time, location=location)

    ras = [obj["ra"] for obj in raw]
    decs = [obj["dec"] for obj in raw]
    coords = SkyCoord(ra=ras * u.deg, dec=decs * u.deg, frame="icrs")
    altaz = coords.transform_to(frame)
    alts = altaz.alt.deg.tolist()
    azs = altaz.az.deg.tolist()

    out: list[DeepSkyObject] = []
    for obj, alt, az in zip(raw, alts, azs):
        if horizon_only and alt < 0:
            continue
        out.append(
            DeepSkyObject(
                id=obj["id"],
                common_name=obj["common_name"],
                messier_id=obj.get("messier_id"),
                type=obj["type"],
                ra=obj["ra"],
                dec=obj["dec"],
                alt=alt,
                az=az,
                magnitude=obj["magnitude"],
                angular_size_arcmin=obj["angular_size_arcmin"],
                minor_axis_arcmin=obj.get("minor_axis_arcmin"),
                position_angle_deg=obj.get("position_angle_deg"),
            )
        )
    return sorted(out, key=lambda d: d.ra)
