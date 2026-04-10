/**
 * Map a Gaia DR3 BP-RP color index to an approximate RGB hex string.
 *
 * BP-RP is a blue-minus-red magnitude (in the Gaia BP and RP bands).
 * Hotter stars (O, B, A) have BP-RP near -0.3 to 0.0 (bluish). Cooler
 * stars (K, M) have BP-RP > 1.5 (reddish/orange). The Sun sits around
 * 0.82 (yellow).
 *
 * This isn't a rigorous colorimetric mapping — it's a visual approximation
 * calibrated for the dark-UI star list. Color mapping fidelity increases
 * in Phase 2b when stars are actually rendered on the canvas.
 */
export function bvToHex(bpRp) {
  if (bpRp == null || !Number.isFinite(bpRp)) {
    return "#ffffff";
  }
  // Clamp to the range we interpolate across
  const bv = Math.max(-0.5, Math.min(2.5, bpRp));

  // Piecewise linear interpolation between calibration points
  // bv, r, g, b (approximate color of the star in hex)
  const stops = [
    [-0.5, 0xa2, 0xc0, 0xff],   // deep blue
    [0.0,  0xca, 0xd7, 0xff],   // blue-white
    [0.5,  0xf8, 0xf7, 0xff],   // near white
    [0.82, 0xff, 0xf4, 0xc8],   // yellow-white (Sun)
    [1.4,  0xff, 0xc6, 0x8a],   // orange
    [2.0,  0xff, 0x9b, 0x64],   // red-orange
    [2.5,  0xff, 0x7c, 0x5c],   // red
  ];

  for (let i = 0; i < stops.length - 1; i++) {
    const [x0, r0, g0, b0] = stops[i];
    const [x1, r1, g1, b1] = stops[i + 1];
    if (bv >= x0 && bv <= x1) {
      const t = (bv - x0) / (x1 - x0);
      const r = Math.round(r0 + (r1 - r0) * t);
      const g = Math.round(g0 + (g1 - g0) * t);
      const b = Math.round(b0 + (b1 - b0) * t);
      return `#${r.toString(16).padStart(2, "0")}${g
        .toString(16)
        .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    }
  }
  return "#ffffff";
}
