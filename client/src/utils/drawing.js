/**
 * Canvas drawing helpers for the sky chart.
 *
 * Pure functions: magnitudeToGlow (data → render spec).
 * Canvas operations (drawStar, drawPlanet) are added in a later task;
 * they receive a 2D context and are not pure, but their size/color
 * inputs come from magnitudeToGlow + bvToHex.
 */

// Calibration stops: [magnitude breakpoint, core px, halo px]
const STAR_GLOW_STOPS = [
  [0, 3.0, 18],
  [2, 2.5, 12],
  [4, 2.0, 6],
  [6, 1.5, 3],
];

const DIM_TIER = { core: 1.0, halo: 0 }; // mag > 6 or invalid

export function magnitudeToGlow(mag) {
  if (mag == null || !Number.isFinite(mag)) return { ...DIM_TIER };
  if (mag > 6) return { ...DIM_TIER };
  if (mag <= 0) return { core: STAR_GLOW_STOPS[0][1], halo: STAR_GLOW_STOPS[0][2] };

  for (let i = 0; i < STAR_GLOW_STOPS.length - 1; i++) {
    const [m0, c0, h0] = STAR_GLOW_STOPS[i];
    const [m1, c1, h1] = STAR_GLOW_STOPS[i + 1];
    if (mag >= m0 && mag <= m1) {
      const t = (mag - m0) / (m1 - m0);
      return {
        core: c0 + (c1 - c0) * t,
        halo: h0 + (h1 - h0) * t,
      };
    }
  }

  return { ...DIM_TIER };
}
