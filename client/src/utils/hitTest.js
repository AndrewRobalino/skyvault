/**
 * Hit testing for mouse/touch events on the sky chart.
 *
 * Linear scan over a pre-projected array of {kind, id, x, y, ...} objects.
 * Returns the nearest object within that kind's cursor radius, or null.
 *
 * At Phase 2b scale (~2000–3500 stars + ~10 planets), a linear scan is
 * ~2000 distance checks per mousemove — trivially fast. If we scale up
 * to 10k+ objects in v2 we'd bucket into a spatial grid.
 */

export const STAR_RADIUS = 14;   // pixels
export const PLANET_RADIUS = 22; // pixels (sparse, larger markers)

function radiusFor(kind) {
  return kind === "planet" ? PLANET_RADIUS : STAR_RADIUS;
}

export function findNearestWithinRadius(projected, mouseX, mouseY) {
  let best = null;
  let bestDistSq = Infinity;

  for (const obj of projected) {
    const r = radiusFor(obj.kind);
    const dx = obj.x - mouseX;
    const dy = obj.y - mouseY;
    const distSq = dx * dx + dy * dy;
    if (distSq > r * r) continue;
    if (distSq < bestDistSq) {
      best = obj;
      bestDistSq = distSq;
    }
  }

  return best;
}
