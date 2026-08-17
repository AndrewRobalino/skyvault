"""Verify the Milky Way backdrop shader math against Astropy ground truth.

Simulates the exact pipeline of ``client/src/utils/glsl/inverseProjection.frag.js``
(inverse stereographic -> AltAz -> equatorial -> galactic -> texture UV) in
Python, and checks that the panorama texel it samples at a feature's screen
position is where that feature actually lives in the eso0932a panorama.

Ground truth per feature (Sgr A*, Antares, Deneb, LMC, Sirius):
  - Astropy ICRS -> AltAz gives the feature's true alt/az for the observer;
    the Canvas 2D forward projection (projection.js) gives its screen pixel.
  - Astropy ICRS -> Galactic gives its true (l, b); the eso0932a layout maps
    that to an image position (galactic center at u=0.5, l increasing
    leftward, NGP at image top — verified against the bulge and LMC/SMC
    pixel positions in the asset).

Expected result: every feature within ~0.4 deg (of-date vs J2000 precession
plus the simplified GMST formula — a couple of pixels of blur on a diffuse
4000x2000 panorama). Run after ANY change to the shader, projection.js, or
computeLST:

    cd server && python scripts/verify_backdrop_projection.py

Exits non-zero if any feature lands more than MAX_SEP_DEG away.
"""

from __future__ import annotations

import math
import sys

from astropy import units as u
from astropy.coordinates import AltAz, EarthLocation, SkyCoord
from astropy.time import Time

TAU = 2 * math.pi
DEG = math.pi / 180

# Shader constants (inverseProjection.frag.js) — J2000, Liu et al. 2011.
GAL_POLE_RA = 3.36603292
GAL_POLE_DEC = 0.4734780
GAL_L_OFFSET = 2.14556962

# Verification tolerance (deg). The physical error budget is ~0.4 deg;
# 0.6 leaves margin without letting a real regression through.
MAX_SEP_DEG = 0.6

FEATURES = [
    ("Sgr A* (gal center)", 266.41683, -29.00781),
    ("Antares", 247.35192, -26.43200),
    ("Deneb", 310.35798, 45.28034),
    ("LMC center", 80.89420, -69.75610),
    ("Sirius", 101.28716, -16.71612),
]

WIDTH, HEIGHT = 1200, 800
LAT, LON = -34.6037, -58.3816  # Buenos Aires — galactic center high, LMC up
WHEN = "2026-07-16T02:00:00"


def compute_lst_js(time_utc: Time, lon_deg: float) -> float:
    """Replica of client computeLST (coordinateTransforms.js): USNO simplified
    GMST, UTC treated as UT1."""
    d = time_utc.jd - 2451545.0
    gmst_hours = (18.697374558 + 24.06570982441908 * d) % 24
    lst_hours = (gmst_hours + lon_deg / 15) % 24
    return (lst_hours / 24) * TAU


def project_altaz(alt_deg: float, az_deg: float) -> tuple[float, float]:
    """Replica of projection.js projectAltAz — inside view, canvas y-down."""
    r = math.tan((90 - alt_deg) * DEG / 2)
    az = az_deg * DEG
    half_short = min(WIDTH, HEIGHT) / 2
    scale = half_short / math.tan((90 - 0.0) * DEG / 2)
    x = WIDTH / 2 + (-r * math.sin(az)) * scale
    y = HEIGHT / 2 + (-r * math.cos(az)) * scale
    return x, y


def shader_sample_uv(px: float, py_down: float, lst: float, lat_rad: float) -> tuple[float, float]:
    """Replica of the fragment shader main() for one pixel (canvas coords)."""
    dx = px - WIDTH / 2
    dy = py_down - HEIGHT / 2
    half_short = min(WIDTH, HEIGHT) / 2
    scale = half_short / math.tan((math.pi / 2 - 0.0) / 2)
    r = math.hypot(dx, dy)
    alt = math.pi / 2 - 2 * math.atan2(r, scale)
    az = math.atan2(-dx, -dy) % TAU

    sin_dec = math.sin(alt) * math.sin(lat_rad) + math.cos(alt) * math.cos(lat_rad) * math.cos(az)
    dec = math.asin(max(-1.0, min(1.0, sin_dec)))
    ha = math.atan2(
        -math.sin(az) * math.cos(alt),
        math.sin(alt) * math.cos(lat_rad) - math.cos(alt) * math.cos(az) * math.sin(lat_rad),
    )
    ra = (lst - ha) % TAU

    sin_b = math.sin(dec) * math.sin(GAL_POLE_DEC) + math.cos(dec) * math.cos(GAL_POLE_DEC) * math.cos(ra - GAL_POLE_RA)
    b = math.asin(max(-1.0, min(1.0, sin_b)))
    yy = math.cos(dec) * math.sin(ra - GAL_POLE_RA)
    xx = math.cos(GAL_POLE_DEC) * math.sin(dec) - math.sin(GAL_POLE_DEC) * math.cos(dec) * math.cos(ra - GAL_POLE_RA)
    gal_l = (GAL_L_OFFSET - math.atan2(yy, xx)) % TAU

    u_tex = (0.5 - gal_l / TAU) % 1.0
    v_tex = (math.pi / 2 - b) / math.pi
    return u_tex, v_tex


def eso0932a_position(l_deg: float, b_deg: float) -> tuple[float, float]:
    """Where a galactic (l, b) actually lives in the panorama (u, v-from-top)."""
    return (0.5 - l_deg / 360.0) % 1.0, (90.0 - b_deg) / 180.0


def main() -> int:
    t = Time(WHEN, scale="utc")
    loc = EarthLocation(lat=LAT * u.deg, lon=LON * u.deg)
    frame = AltAz(obstime=t, location=loc)
    lst = compute_lst_js(t, LON)

    print(f"Observer lat={LAT} lon={LON}  {WHEN}Z  canvas {WIDTH}x{HEIGHT}")
    header = f"{'feature':22s} {'alt':>7s} {'az':>7s}   {'sep (deg)':>9s}"
    print(header)
    print("-" * len(header))

    worst = 0.0
    for name, ra_icrs, dec_icrs in FEATURES:
        c = SkyCoord(ra=ra_icrs * u.deg, dec=dec_icrs * u.deg, frame="icrs")
        aa = c.transform_to(frame)

        px, py = project_altaz(aa.alt.deg, aa.az.deg)
        u_s, v_s = shader_sample_uv(px, py, lst, LAT * DEG)

        # Invert the layout to compare on the sphere (robust near the poles,
        # where a fixed UV tolerance would be misleading).
        sampled = SkyCoord(
            l=((0.5 - u_s) % 1.0) * 360.0 * u.deg,
            b=(90.0 - v_s * 180.0) * u.deg,
            frame="galactic",
        )
        sep = sampled.separation(c.galactic).deg
        worst = max(worst, sep)
        print(f"{name:22s} {aa.alt.deg:7.2f} {aa.az.deg:7.2f}   {sep:9.3f}")

    print(f"\nworst separation: {worst:.3f} deg (budget {MAX_SEP_DEG})")
    if worst > MAX_SEP_DEG:
        print("FAIL — backdrop projection has regressed.")
        return 1
    print("OK — backdrop samples the panorama where Astropy says features are.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
