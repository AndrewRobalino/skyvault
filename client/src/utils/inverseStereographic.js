/**
 * Inverse stereographic projection: screen pixel (x, y) → (altDeg, azDeg).
 *
 * Inverse of projection.js's projectAltAz. Mirrors the shader math
 * (inverseProjection.frag.js) exactly, so unit tests against this JS
 * function double as tests for the shader's projection step.
 *
 * Azimuth convention matches projection.js:
 *   0° = north, 90° = east, 180° = south, 270° = west.
 * Screen orientation is the inside view (north up, east LEFT), mirroring
 * projection.js's forward map x = -sin(az), y = -cos(az).
 * Returned azimuth is normalized to [0, 360).
 *
 * @param {number} x — pixel x (0 = canvas left edge)
 * @param {number} y — pixel y (0 = canvas top edge)
 * @param {number} width
 * @param {number} height
 * @param {number} refAltDeg — projection reference altitude (0 in Phase 2c)
 * @returns {{ altDeg: number, azDeg: number }}
 */
export function inverseStereographic(x, y, width, height, refAltDeg) {
  const cx = width / 2;
  const cy = height / 2;
  const halfShort = Math.min(width, height) / 2;

  const refZenithAngle = (90 - refAltDeg) * (Math.PI / 180);
  const scale = halfShort / Math.tan(refZenithAngle / 2);

  const dx = x - cx;
  const dy = y - cy;
  const r = Math.sqrt(dx * dx + dy * dy);

  const zenithAngle = 2 * Math.atan(r / scale);
  const altDeg = 90 - zenithAngle * (180 / Math.PI);

  if (r < 1e-9) {
    return { altDeg, azDeg: 0 };
  }

  let azRad = Math.atan2(-dx, -dy);
  if (azRad < 0) azRad += 2 * Math.PI;
  const azDeg = azRad * (180 / Math.PI);

  return { altDeg, azDeg };
}
