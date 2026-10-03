/**
 * Faintest star magnitude to DRAW for a chart of a given size.
 *
 * Star dots are a fixed number of pixels, so drawing every naked-eye star
 * into a small (phone) chart packs them ~15x denser than on a laptop and the
 * sky turns into speckle. Planetarium software solves this the same way:
 * fewer, brighter stars when the view is smaller. Here the number of stars
 * drawn scales with the chart's area, so star DENSITY matches the laptop view.
 *
 * Only rendering changes: the API data, positions and Save image are untouched.
 */

export const FULL_MAG_LIMIT = 6.5; // what the API serves (naked-eye limit)
export const REFERENCE_DIAMETER_PX = 500; // a laptop chart's horizon circle

// Measured on our Gaia + Hipparcos catalog: counts grow x1.75 per 0.5 mag
// (G<=4.5: 1278 ... G<=6.5: 12191), i.e. x3.1 per magnitude.
const COUNT_RATIO_PER_MAG = 3.1;

// Below this the chart would lose stars that draw the familiar constellations.
const FLOOR_MAG = 4.5;

export function renderMagLimit(diameterPx) {
  if (!(diameterPx > 0)) return FULL_MAG_LIMIT; // not measured yet
  const areaRatio = (diameterPx / REFERENCE_DIAMETER_PX) ** 2;
  const limit = FULL_MAG_LIMIT + Math.log(areaRatio) / Math.log(COUNT_RATIO_PER_MAG);
  return Math.min(FULL_MAG_LIMIT, Math.max(FLOOR_MAG, limit));
}
