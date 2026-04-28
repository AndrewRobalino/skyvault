/**
 * Atmospheric horizon haze multipliers for stars and planets.
 *
 * Approximates the visual effect of looking through more atmosphere
 * near the horizon: stars dim and shift toward warmer hues. Stops are
 * tuned by eye to match astrophotography reference images.
 *
 * Returned multipliers:
 *   brightnessMul ∈ [0.3, 1.0] — multiply gradient/disc alpha
 *   redShift     ∈ [0, 0.6]    — blend factor toward warm tint #ffaa66
 */

const STOPS = [
  { alt: 0, brightnessMul: 0.3, redShift: 0.6 },
  { alt: 10, brightnessMul: 0.7, redShift: 0.3 },
  { alt: 30, brightnessMul: 1.0, redShift: 0.0 },
];

/**
 * @param {number} altDeg — altitude in degrees
 * @returns {{ brightnessMul: number, redShift: number }}
 */
export function horizonHaze(altDeg) {
  if (altDeg <= STOPS[0].alt) {
    return { brightnessMul: STOPS[0].brightnessMul, redShift: STOPS[0].redShift };
  }
  if (altDeg >= STOPS[STOPS.length - 1].alt) {
    return { brightnessMul: 1.0, redShift: 0 };
  }
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i];
    const b = STOPS[i + 1];
    if (altDeg >= a.alt && altDeg <= b.alt) {
      const t = (altDeg - a.alt) / (b.alt - a.alt);
      return {
        brightnessMul: a.brightnessMul + (b.brightnessMul - a.brightnessMul) * t,
        redShift: a.redShift + (b.redShift - a.redShift) * t,
      };
    }
  }
  return { brightnessMul: 1.0, redShift: 0 };
}
