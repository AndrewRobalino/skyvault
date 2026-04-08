"""Planet ephemerides via JPL DE421 (Astropy).

Physics notes:

1. **Ephemeris source:** NASA JPL DE421 — a high-accuracy numerical integration
   of the Solar System published by JPL. Astropy ships integration with it;
   we just flip the switch via ``solar_system_ephemeris.set('de421')``.

2. **Frame chain:** ``get_body(name, time, location)`` returns a GCRS
   (geocentric ICRS) ``SkyCoord`` for the body. We pass ``location`` so the
   Moon's topocentric parallax is handled correctly (the Moon is close
   enough that geocentric vs topocentric differs by up to ~1°). From there
   we transform to the observer's local AltAz frame, same as stars.

3. **Distance:** The returned ``SkyCoord.distance`` is the geocentric (or
   topocentric for the Moon) distance to the body in AU. This is *not* the
   heliocentric distance; don't confuse them.

4. **Pluto:** intentionally excluded. Not in DE421, and not a planet by IAU's
   2006 definition. This is a real accuracy decision, not a meme.
"""

from __future__ import annotations

from astropy import units as u
from astropy.coordinates import AltAz, EarthLocation, get_body, solar_system_ephemeris
from astropy.time import Time

from app.config import settings


# Order matters for deterministic output — Sun first, then Moon, then planets
# in orbital order.
BODIES: tuple[str, ...] = (
    "sun",
    "moon",
    "mercury",
    "venus",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
)

SOURCE_LABEL = "JPL DE421 via Astropy"


class EphemerisNotDownloadedError(RuntimeError):
    """Raised when the DE421 SPK kernel is missing from disk."""


def _resolve_kernel() -> str:
    """Return the ephemeris identifier to pass to Astropy.

    We always load from a local, pinned .bsp file rather than Astropy's
    built-in URL mapping — that mapping has drifted as NAIF reorganized
    their server, and pinning keeps the render pipeline reproducible and
    offline-capable.
    """
    kernel_path = settings.ephemeris_kernel_path
    if not kernel_path.exists():
        raise EphemerisNotDownloadedError(
            f"DE421 kernel not found at {kernel_path}. "
            f"Run `python scripts/download_ephemeris.py` to fetch it from NAIF."
        )
    return str(kernel_path)


def compute_planet_positions(
    observer_lat: float,
    observer_lon: float,
    observer_time: str,
    *,
    horizon_only: bool = False,
) -> list[dict]:
    """Return AltAz positions and distances for Sun, Moon, and the 8 planets.

    Parameters
    ----------
    observer_lat, observer_lon
        Observer geodetic coordinates in degrees.
    observer_time
        Observation time as an ISO 8601 UTC string.
    horizon_only
        If True, drop bodies below the local horizon.
    """
    location = EarthLocation(lat=observer_lat * u.deg, lon=observer_lon * u.deg)
    obs_time = Time(observer_time.replace("Z", ""), scale="utc")
    altaz_frame = AltAz(obstime=obs_time, location=location)

    kernel = _resolve_kernel()

    results: list[dict] = []
    # Context manager scopes the DE421 selection to this call — avoids
    # globally mutating Astropy state for anyone else using it.
    with solar_system_ephemeris.set(kernel):
        for name in BODIES:
            body = get_body(name, obs_time, location)
            altaz = body.transform_to(altaz_frame)
            alt_deg = float(altaz.alt.to(u.deg).value)
            az_deg = float(altaz.az.to(u.deg).value)
            distance_au = float(body.distance.to(u.au).value)

            if horizon_only and alt_deg < 0.0:
                continue

            results.append(
                {
                    "name": name,
                    "alt": alt_deg,
                    "az": az_deg,
                    "distance_au": distance_au,
                    "source": SOURCE_LABEL,
                }
            )

    return results
