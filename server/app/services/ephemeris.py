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

import math

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


def _phase_name_from_angle_and_trend(phase_angle_deg: float, waxing: bool) -> str:
    """Map (phase_angle, waxing/waning) to a human phase name.

    Phase angle is the Sun-Moon-Earth angle:
      - 0°   → full moon (Sun opposite Moon)
      - 90°  → first/last quarter
      - 180° → new moon (Sun near Moon)

    ``waxing`` disambiguates the two halves of the cycle: from new → full the
    Moon is waxing, from full → new it is waning.
    """
    # Illumination bucket (same for both halves)
    if phase_angle_deg < 7.0:
        return "full moon"
    if phase_angle_deg > 173.0:
        return "new moon"
    if abs(phase_angle_deg - 90.0) < 7.0:
        return "first quarter" if waxing else "last quarter"
    if phase_angle_deg < 90.0:
        return "waxing gibbous" if waxing else "waning gibbous"
    # 90 < phase_angle < 173
    return "waxing crescent" if waxing else "waning crescent"


def _compute_moon_phase(
    moon_gcrs,
    sun_gcrs,
    obs_time: Time,
) -> tuple[float, float, str]:
    """Return (phase_angle_deg, illumination_fraction, phase_name).

    Phase angle is the Sun-Moon-Earth angle, computed from the geocentric
    position vectors of the Sun and Moon. Illumination follows the standard
    identity ``k = (1 + cos(phase_angle)) / 2``.

    Waxing vs waning is disambiguated by sampling the phase angle 6 hours
    later: if the future phase angle is smaller, the Moon is approaching
    0° (full) and therefore waxing; if larger, it is approaching 180° (new)
    and waning. A 6-hour delta is plenty versus the Moon's mean motion of
    ~12°/day.
    """
    # Current geocentric vectors
    moon_xyz = moon_gcrs.cartesian.xyz.to(u.au).value
    sun_xyz = sun_gcrs.cartesian.xyz.to(u.au).value

    # Phase angle at Earth: angle between -moon_vector and sun_vector
    # (seen from the Moon, toward Earth and toward Sun). Equivalently:
    # angle between moon_vector and sun_vector seen from Earth, then 180° - that.
    # Use the standard formula directly.
    dot = float(
        (moon_xyz[0] * sun_xyz[0] + moon_xyz[1] * sun_xyz[1] + moon_xyz[2] * sun_xyz[2])
    )
    moon_mag = float(math.sqrt(sum(v * v for v in moon_xyz)))
    sun_mag = float(math.sqrt(sum(v * v for v in sun_xyz)))
    cos_elong = dot / (moon_mag * sun_mag)
    cos_elong = max(-1.0, min(1.0, cos_elong))   # clamp for numerical safety
    elongation = math.acos(cos_elong)
    # Phase angle is the Sun-Moon-Earth angle; for distant Sun,
    # phase_angle ≈ π - elongation (see Meeus, Astronomical Algorithms §48).
    phase_angle_rad = math.pi - elongation
    phase_angle_deg = math.degrees(phase_angle_rad)

    illumination = (1.0 + math.cos(phase_angle_rad)) / 2.0

    # Determine waxing vs waning by sampling 6 hours later
    future_time = obs_time + 6 * u.hour
    future_moon = get_body("moon", future_time)
    future_sun = get_body("sun", future_time)
    fm_xyz = future_moon.cartesian.xyz.to(u.au).value
    fs_xyz = future_sun.cartesian.xyz.to(u.au).value
    f_dot = float(
        (fm_xyz[0] * fs_xyz[0] + fm_xyz[1] * fs_xyz[1] + fm_xyz[2] * fs_xyz[2])
    )
    f_moon_mag = float(math.sqrt(sum(v * v for v in fm_xyz)))
    f_sun_mag = float(math.sqrt(sum(v * v for v in fs_xyz)))
    f_cos_elong = f_dot / (f_moon_mag * f_sun_mag)
    f_cos_elong = max(-1.0, min(1.0, f_cos_elong))
    f_elongation = math.acos(f_cos_elong)
    f_phase_angle = math.pi - f_elongation

    # If the phase angle is decreasing, the Moon is approaching 0° (full) → waxing.
    # If increasing, it is approaching 180° (new) → waning.
    waxing = f_phase_angle < phase_angle_rad

    phase_name = _phase_name_from_angle_and_trend(phase_angle_deg, waxing)
    return phase_angle_deg, illumination, phase_name


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
        # Precompute the Sun's geocentric position once for the moon phase
        # calculation. We still re-query it inside the loop so the returned
        # Sun entry uses the same call path as every other body — but we
        # stash the SkyCoord here for phase computation.
        sun_gcrs_at_obs = get_body("sun", obs_time)

        for name in BODIES:
            body = get_body(name, obs_time, location)
            altaz = body.transform_to(altaz_frame)
            alt_deg = float(altaz.alt.to(u.deg).value)
            az_deg = float(altaz.az.to(u.deg).value)
            distance_au = float(body.distance.to(u.au).value)

            if horizon_only and alt_deg < 0.0:
                continue

            entry: dict = {
                "name": name,
                "alt": alt_deg,
                "az": az_deg,
                "distance_au": distance_au,
                "source": SOURCE_LABEL,
                "phase_angle": None,
                "illumination": None,
                "phase_name": None,
            }

            if name == "moon":
                # Use the non-topocentric (geocentric) Moon for phase math —
                # parallax of ~1° doesn't meaningfully shift the Sun-Moon-Earth
                # angle, and geocentric is the canonical frame for lunar phase.
                moon_geocentric = get_body("moon", obs_time)
                phase_deg, illum, phase_name = _compute_moon_phase(
                    moon_geocentric, sun_gcrs_at_obs, obs_time
                )
                entry["phase_angle"] = phase_deg
                entry["illumination"] = illum
                entry["phase_name"] = phase_name

            results.append(entry)

    return results
