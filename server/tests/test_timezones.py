"""Offline lat/lon -> IANA time zone lookup (timezonefinder)."""

from __future__ import annotations

import pytest

from app.services.timezones import timezone_for


@pytest.mark.parametrize(
    ("lat", "lon", "expected"),
    [
        (35.6895, 139.6917, "Asia/Tokyo"),
        (25.7617, -80.1918, "America/New_York"),
        (-34.6037, -58.3816, "America/Argentina/Buenos_Aires"),
        (64.1466, -21.9426, "Atlantic/Reykjavik"),
    ],
)
def test_timezone_for_known_cities(lat, lon, expected):
    assert timezone_for(lat, lon) == expected


def test_open_ocean_gets_a_nautical_zone_not_none():
    # Mid-Pacific: no civil zone, but timezonefinder returns the Etc/GMT zone
    # for that longitude band, which is still a valid IANA name.
    assert timezone_for(0.0, -150.0) == "Etc/GMT+10"
