"""ICRS -> AltAz coordinate transforms for the Gaia catalog.

Astronomy notes — because this is where physics mistakes would hide:

1. **Source frame:** Gaia DR3 positions are ICRS at reference epoch **J2016.0**.
   They are *not* the current position of the star. Over a decade, high
   proper-motion stars (Barnard's, Kapteyn's, ε Eri, etc.) drift by several
   arcseconds — visible in a rendered sky.

2. **Proper motion:** We apply space motion from J2016.0 to the observation
   epoch using ``SkyCoord.apply_space_motion``. This requires ``pm_ra_cosdec``,
   ``pm_dec``, a ``distance`` (computed from parallax), and an ``obstime``.

3. **Target frame:** AltAz with the observer's ``EarthLocation`` and the
   observation ``Time``. Astropy internally handles precession, nutation,
   Earth rotation, and aberration when transforming ICRS -> AltAz.

4. **Atmosphere:** We do *not* apply refraction. It's a small (<0.5°) effect
   that depends on pressure/temperature/humidity, and we don't ask the user
   for those. Skipping it is a deliberate tradeoff.

5. **Parallax fallback:** A handful of Gaia sources have null or negative
   parallax (noise in the astrometric solution). We substitute a large
   placeholder distance for those — they're effectively at infinity for
   rendering purposes anyway.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from astropy import units as u
from astropy.coordinates import AltAz, EarthLocation, SkyCoord
from astropy.time import Time


# Gaia DR3 reference epoch — all catalog positions are as-of this instant.
GAIA_REFERENCE_EPOCH = Time("J2016.0")

# For stars with missing/bad parallax, treat them as effectively at infinity.
# Astropy needs a positive distance when applying space motion; 1 Mpc is a
# convenient "very far away" sentinel that has no measurable impact on AltAz.
FALLBACK_DISTANCE_PC = 1_000_000.0  # 1 Mpc in parsecs


def _parallax_to_distance_pc(parallax_mas: np.ndarray) -> np.ndarray:
    """Convert parallax in milliarcseconds to distance in parsecs.

    Null or non-positive parallaxes get a huge fallback distance so Astropy
    doesn't choke on them.
    """
    parallax = np.asarray(parallax_mas, dtype=float)
    safe = np.where((parallax > 0) & np.isfinite(parallax), parallax, np.nan)
    distance = 1000.0 / safe  # mas -> parsecs
    return np.where(np.isnan(distance), FALLBACK_DISTANCE_PC, distance)


def compute_altaz(
    stars: pd.DataFrame,
    observer_lat: float,
    observer_lon: float,
    observer_time: str,
    *,
    horizon_only: bool = False,
) -> pd.DataFrame:
    """Transform a Gaia star DataFrame from ICRS to observer-frame AltAz.

    Parameters
    ----------
    stars
        DataFrame with at minimum: ``ra``, ``dec``, ``pmra``, ``pmdec``,
        ``parallax``. Additional Gaia columns are passed through unchanged.
    observer_lat
        Observer geodetic latitude in degrees.
    observer_lon
        Observer geodetic longitude in degrees.
    observer_time
        Observation time as an ISO 8601 UTC string (e.g. ``"2026-01-15T02:00:00Z"``).
    horizon_only
        If True, drop stars below the local horizon (alt < 0).

    Returns
    -------
    pandas.DataFrame
        A copy of the input with ``alt`` and ``az`` columns added, both in
        degrees. If ``horizon_only`` is set, below-horizon rows are filtered.
    """
    if len(stars) == 0:
        out = stars.copy()
        out["alt"] = pd.Series(dtype=float)
        out["az"] = pd.Series(dtype=float)
        return out

    location = EarthLocation(lat=observer_lat * u.deg, lon=observer_lon * u.deg)
    # Astropy parses trailing "Z" fine, but normalize for clarity.
    obs_time = Time(observer_time.replace("Z", ""), scale="utc")

    parallax_raw = stars["parallax"].to_numpy(dtype=float)
    distance_pc = _parallax_to_distance_pc(parallax_raw)

    # Rows without a valid parallax get their proper motion zeroed out. The
    # alternative — propagating motion with a huge fallback distance — makes
    # pmsafe diverge (implied transverse velocity > c) and silently NaNs the
    # resulting alt/az. Zeroing the pm pins the star at its J2016.0 position,
    # which is honest: we don't know the 3D motion, so we don't pretend to.
    bad_astrometry = ~np.isfinite(parallax_raw) | (parallax_raw <= 0)
    pmra = np.where(bad_astrometry, 0.0, stars["pmra"].to_numpy(dtype=float))
    pmdec = np.where(bad_astrometry, 0.0, stars["pmdec"].to_numpy(dtype=float))
    # Also scrub NaN pm values on rows with good parallax (very rare, but
    # they exist in Gaia DR3 for sources with too few astrometric observations).
    pmra = np.where(np.isfinite(pmra), pmra, 0.0)
    pmdec = np.where(np.isfinite(pmdec), pmdec, 0.0)

    # Build the SkyCoord at the Gaia reference epoch with full 6D state so
    # apply_space_motion can propagate it to the observation epoch.
    catalog = SkyCoord(
        ra=stars["ra"].to_numpy() * u.deg,
        dec=stars["dec"].to_numpy() * u.deg,
        pm_ra_cosdec=pmra * (u.mas / u.yr),
        pm_dec=pmdec * (u.mas / u.yr),
        distance=distance_pc * u.pc,
        obstime=GAIA_REFERENCE_EPOCH,
        frame="icrs",
    )

    current = catalog.apply_space_motion(new_obstime=obs_time)
    altaz = current.transform_to(AltAz(obstime=obs_time, location=location))

    out = stars.copy()
    out["alt"] = altaz.alt.to(u.deg).value
    out["az"] = altaz.az.to(u.deg).value

    if horizon_only:
        out = out.loc[out["alt"] >= 0.0].reset_index(drop=True)

    return out
