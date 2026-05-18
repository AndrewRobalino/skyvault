/**
 * Stereographic projection from zenith.
 *
 * Given an altitude / azimuth pair in degrees, returns (x, y) pixel
 * coordinates inside a rectangle of size (width × height). The zenith
 * (alt=90°) maps to the rectangle center. An object at REFERENCE_ALT°
 * altitude maps to the shorter half-edge of the rectangle, so
 * everything from zenith down to REFERENCE_ALT fills the rectangle.
 *
 * Azimuth convention: 0° = north, 90° = east, 180° = south, 270° = west.
 * Canvas y increases downward, so north appears above zenith on screen.
 *
 * Phase 3+ will add new kinds (constellation_line, galaxy, comet). The
 * projection pipeline stays the same for any point object.
 */

export const REFERENCE_ALT = 0; // degrees — Phase 2c: horizon at short-edge inscribed circle

const DEG = Math.PI / 180;

export function projectAltAz({ alt, az }, width, height) {
  const zenithAngle = (90 - alt) * DEG;     // radians; 0 at zenith
  const r = Math.tan(zenithAngle / 2);      // stereographic radial distance

  const azRad = az * DEG;
  const xNorm = r * Math.sin(azRad);        // east positive
  const yNorm = -r * Math.cos(azRad);       // screen y down, north up

  const halfShort = Math.min(width, height) / 2;
  const refZenithAngle = (90 - REFERENCE_ALT) * DEG;
  const scale = halfShort / Math.tan(refZenithAngle / 2);

  return {
    x: width / 2 + xNorm * scale,
    y: height / 2 + yNorm * scale,
  };
}

export function projectStars(stars, width, height) {
  return stars.map((s) => {
    const { x, y } = projectAltAz(s, width, height);
    return {
      kind: "star",
      id: `star:${s.source_id}`,
      source_id: s.source_id,
      x,
      y,
      alt: s.alt,
      az: s.az,
      magnitude: s.magnitude,
      bp_rp: s.bp_rp,
      distance_ly: s.distance_ly,
      parallax_mas: s.parallax_mas,
      teff_k: s.teff_k,
      source: s.source ?? "Gaia DR3",
    };
  });
}

export function projectPlanets(planets, width, height) {
  return planets.map((p) => {
    const { x, y } = projectAltAz(p, width, height);
    return {
      kind: "planet",
      id: `planet:${p.name}`,
      name: p.name,
      x,
      y,
      alt: p.alt,
      az: p.az,
      distance_au: p.distance_au,
      phase_angle: p.phase_angle ?? null,
      illumination: p.illumination ?? null,
      phase_name: p.phase_name ?? null,
      source: p.source ?? "JPL DE421 via Astropy",
    };
  });
}

export function projectDsos(dsos, width, height) {
  if (!dsos || !dsos.length || !width || !height) return [];

  // Sizing scale: REFERENCE_ALT=0 means alt=0 maps to halfShort.
  // Near-zenith linearization: 90° of sky spans halfShort px, so
  // pxPerArcmin ≈ halfShort / 90 / 60. Slight stereographic distortion
  // toward the horizon is acceptable for DSO sizing.
  const halfShort = Math.min(width, height) / 2;
  const pxPerArcmin = halfShort / 90 / 60;

  return dsos.map((d) => {
    const { x, y } = projectAltAz(d, width, height);
    const majorPx = (d.angular_size_arcmin ?? 0) * pxPerArcmin;
    return {
      kind: "dso",
      id: `dso:${d.id}`,
      dso_id: d.id,
      common_name: d.common_name,
      messier_id: d.messier_id ?? null,
      type: d.type,
      x,
      y,
      alt: d.alt,
      az: d.az,
      magnitude: d.magnitude,
      angular_size_arcmin: d.angular_size_arcmin,
      minor_axis_arcmin: d.minor_axis_arcmin ?? null,
      position_angle_deg: d.position_angle_deg ?? null,
      pxPerArcmin,
      hitRadius: Math.max(12, majorPx / 2),
      source: d.source ?? "SIMBAD/CDS",
    };
  });
}
