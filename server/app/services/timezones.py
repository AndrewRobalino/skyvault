"""Offline lat/lon -> IANA time zone lookup.

Lets the UI's "Local" time mean the observed place's local time rather than
the browser's. Backed by timezonefinder, whose boundary polygons come from
timezone-boundary-builder (OpenStreetMap data, ODbL). Pure in-memory lookup,
~1 microsecond per call: no network on the request path.
"""

from __future__ import annotations

from functools import lru_cache

from timezonefinder import TimezoneFinder


@lru_cache(maxsize=1)
def _finder() -> TimezoneFinder:
    return TimezoneFinder()


def timezone_for(lat: float, lon: float) -> str | None:
    """IANA zone name for a point (e.g. "Asia/Tokyo").

    Open ocean resolves to the longitude band's ``Etc/GMT±N`` zone.
    """
    return _finder().timezone_at(lat=lat, lng=lon)
