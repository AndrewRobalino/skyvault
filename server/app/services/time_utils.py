"""Shared UTC parsing for observation-time query parameters.

Every observer-parameterized endpoint takes ``datetime`` as an ISO 8601 UTC
string. This helper is the single place that string becomes an
``astropy.time.Time`` — replacing four copies of ``.replace("Z", "")`` that
silently broke on offset forms like ``+00:00`` (Astropy's ISO parser does
not accept timezone offsets).
"""

from __future__ import annotations

from datetime import datetime, timezone

from astropy.time import Time


class InvalidObservationTimeError(ValueError):
    """Raised when an observation-time string is not parseable ISO 8601.

    Routers map this to a 422 so malformed client input never surfaces
    as a 500.
    """


def parse_utc_time(value: str) -> Time:
    """Parse an ISO 8601 datetime string into an Astropy ``Time`` (UTC scale).

    Accepts the frontend's Z-suffixed form (``2026-01-15T02:00:00Z``, with or
    without fractional seconds), explicit offsets (``+00:00``, ``-05:00`` —
    converted to UTC), and naive strings (assumed UTC per the API contract).
    """
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError) as exc:
        raise InvalidObservationTimeError(
            f"Invalid observation datetime {value!r}: expected ISO 8601 UTC, "
            f'e.g. "2026-01-15T02:00:00Z"'
        ) from exc

    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return Time(dt, scale="utc")
