/**
 * Size factor for star/planet/DSO markers on charts smaller than a laptop's.
 *
 * Marker sizes are tuned in CSS pixels for a laptop chart. A phone chart is
 * not just fewer pixels: it is physically ~5 cm across on a sharp, bright
 * screen, so markers shrunk only in proportion still look crowded and glaring.
 * The reference for "looks right" is the downloaded snapshot: laptop-sized
 * markers drawn into a 1000 px sky, then shrunk to the phone screen, i.e.
 * markers ~0.34x on a ~340 px chart. Scaling with the SQUARE of the size
 * ratio hits both anchors: 1.0 at laptop size, ~0.37 at phone size.
 */

export const REFERENCE_DIAMETER_PX = 560; // a laptop chart's horizon circle
const FLOOR = 0.25; // below this, faint stars would vanish entirely

export function markerScale(diameterPx) {
  if (!(diameterPx > 0)) return 1; // not measured yet
  const ratio = Math.min(1, diameterPx / REFERENCE_DIAMETER_PX);
  return Math.max(FLOOR, ratio * ratio);
}
