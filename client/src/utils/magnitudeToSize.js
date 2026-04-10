/**
 * Map an apparent magnitude to a CSS pixel size for display purposes.
 * Lower magnitude = brighter = larger dot. Clamped to [2, 14] px.
 */
export function magnitudeToSize(magnitude) {
  if (magnitude == null || !Number.isFinite(magnitude)) return 4;
  // Rough: magnitude -1 → 14px, magnitude 6 → 2px
  const size = 14 - (magnitude + 1) * (12 / 7);
  return Math.max(2, Math.min(14, size));
}
