/**
 * Frontend astronomy helpers used by the WebGL backdrop shader.
 *
 * Backend (Astropy) remains the source of truth for all star/planet
 * positions. These functions exist only so the shader can compute LST
 * from observer state without a backend roundtrip.
 */

const TAU = Math.PI * 2;

/**
 * Local Sidereal Time in radians, in [0, 2π).
 *
 * Computed from UTC `datetime` and observer `lonDeg` using the standard
 * USNO simplified formula (Meeus Ch. 12). Accuracy < 1 arcsecond for
 * dates within a few decades of J2000 — well inside our visual budget.
 *
 * @param {string|Date} datetime — UTC instant (ISO 8601 string or Date)
 * @param {number} lonDeg — observer longitude in degrees, east positive
 * @returns {number} LST in radians, in [0, 2π)
 */
export function computeLST(datetime, lonDeg) {
  const date = datetime instanceof Date ? datetime : new Date(datetime);
  const jd = julianDate(date);

  // GMST in hours (USNO simplified):
  // GMST = 18.697374558 + 24.06570982441908 × (JD − 2451545.0)
  const d = jd - 2451545.0;
  let gmstHours = 18.697374558 + 24.06570982441908 * d;
  gmstHours = ((gmstHours % 24) + 24) % 24;

  let lstHours = gmstHours + lonDeg / 15;
  lstHours = ((lstHours % 24) + 24) % 24;

  return (lstHours / 24) * TAU;
}

function julianDate(date) {
  const ms = date.getTime();
  return ms / 86400000 + 2440587.5;
}
