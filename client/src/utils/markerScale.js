/**
 * Size factor for star/planet/DSO markers on charts smaller than a laptop's.
 *
 * Marker sizes are tuned in CSS pixels for a laptop chart. Drawn at those
 * same pixel sizes into a ~290 px phone chart, every star is ~2x too big
 * relative to the sky and bright-star glows turn into blotches. Scaling the
 * markers with the chart makes the phone look like the laptop chart shrunk
 * (which is exactly why a downloaded snapshot, viewed on a phone, looks right).
 */

export const REFERENCE_DIAMETER_PX = 560; // a laptop chart's horizon circle
const FLOOR = 0.35; // below this, faint stars would vanish entirely

export function markerScale(diameterPx) {
  if (!(diameterPx > 0)) return 1; // not measured yet
  return Math.min(1, Math.max(FLOOR, diameterPx / REFERENCE_DIAMETER_PX));
}
