"""ICRS -> AltAz coordinate transforms for the Gaia catalog.

Astronomy notes — because this is where physics mistakes would hide:

1. **Source frame:** Gaia DR3 positions are ICRS at reference epoch **J2016.0**.
   They are *not* the current position of the star. Over a decade, high
   proper-motion stars (Barnard's, Kapteyn's, ε Eri, etc.) drift by several
   arcseconds — visible in a rendered sky. The Hipparcos bright-star
   supplement is ICRS at **J1991.25**; each row's ``epoch`` column says which,
   and rows without one are Gaia.

2. **Proper motion:** We apply space motion from each star's epoch to the observation
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

from app.services.time_utils import parse_utc_time


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


def _epoch_groups(stars: pd.DataFrame) -> list[tuple[Time, np.ndarray]]:
    """Split rows by catalog reference epoch: [(epoch, row mask), ...].

    Gaia DR3 is J2016.0; the Hipparcos bright-star supplement is J1991.25.
    Rows without an ``epoch`` (no column, or NaN after a concat) are Gaia.

    Each group is transformed with a *scalar* obstime. A per-row Time array
    gives the same answer but doubled the /sky transform (85 -> 169 ms for
    ~6k stars), because Astropy converts every element's time scale
    individually. An all-Gaia frame is a single group — the original path.
    """
    if "epoch" not in stars.columns:
        return [(GAIA_REFERENCE_EPOCH, np.ones(len(stars), dtype=bool))]
    labels = stars["epoch"].fillna(GAIA_REFERENCE_EPOCH.jyear_str).to_numpy()
    return [(Time(label), labels == label) for label in pd.unique(labels)]


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
    obs_time = parse_utc_time(observer_time)

    parallax_raw = stars["parallax"].to_numpy(dtype=float)
    distance_pc = _parallax_to_distance_pc(parallax_raw)

    # Rows without a valid parallax get their proper motion zeroed out. The
    # alternative — propagating motion with a huge fallback distance — makes
    # pmsafe diverge (implied transverse velocity > c) and silently NaNs the
    # resulting alt/az. Zeroing the pm pins the star at its catalog-epoch position,
    # which is honest: we don't know the 3D motion, so we don't pretend to.
    bad_astrometry = ~np.isfinite(parallax_raw) | (parallax_raw <= 0)
    pmra = np.where(bad_astrometry, 0.0, stars["pmra"].to_numpy(dtype=float))
    pmdec = np.where(bad_astrometry, 0.0, stars["pmdec"].to_numpy(dtype=float))
    # Also scrub NaN pm values on rows with good parallax (very rare, but
    # they exist in Gaia DR3 for sources with too few astrometric observations).
    pmra = np.where(np.isfinite(pmra), pmra, 0.0)
    pmdec = np.where(np.isfinite(pmdec), pmdec, 0.0)

    ra = stars["ra"].to_numpy(dtype=float)
    dec = stars["dec"].to_numpy(dtype=float)
    frame = AltAz(obstime=obs_time, location=location)
    alt = np.empty(len(stars))
    az = np.empty(len(stars))

    # Build each group's SkyCoord at its catalog reference epoch with full 6D
    # state so apply_space_motion can propagate it to the observation epoch.
    for epoch, mask in _epoch_groups(stars):
        catalog = SkyCoord(
            ra=ra[mask] * u.deg,
            dec=dec[mask] * u.deg,
            pm_ra_cosdec=pmra[mask] * (u.mas / u.yr),
            pm_dec=pmdec[mask] * (u.mas / u.yr),
            distance=distance_pc[mask] * u.pc,
            obstime=epoch,
            frame="icrs",
        )
        current = catalog.apply_space_motion(new_obstime=obs_time)
        altaz = current.transform_to(frame)
        alt[mask] = altaz.alt.to(u.deg).value
        az[mask] = altaz.az.to(u.deg).value

    out = stars.copy()
    out["alt"] = alt
    out["az"] = az

    if horizon_only:
        out = out.loc[out["alt"] >= 0.0].reset_index(drop=True)

    return out
