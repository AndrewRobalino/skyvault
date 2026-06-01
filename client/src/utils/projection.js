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

function titleCasePlanetName(name) {
  if (typeof name !== "string" || name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

// Real equatorial diameters (km). NASA / IAU fact sheets.
const PLANET_DIAMETER_KM = {
  Sun: 1_392_700,
  Moon: 3474.8,
  Mercury: 4879.4,
  Venus: 12_104,
  Mars: 6792,
  Jupiter: 142_984,
  Saturn: 120_536,
  Uranus: 51_118,
  Neptune: 49_528,
};

const AU_KM = 149_597_870.7;
const RAD_TO_ARCSEC = 206_264.806;

// Apparent angular diameter from Earth, in arcseconds.
// Approximation valid for d << observer distance: θ ≈ diameter / distance.
function apparentArcsec(name, distanceAu) {
  const d = PLANET_DIAMETER_KM[name];
  if (!d || !Number.isFinite(distanceAu) || distanceAu <= 0) return null;
  return (d / (distanceAu * AU_KM)) * RAD_TO_ARCSEC;
}

// Log-scale apparent arcsec → marker diameter in px.
// Anchored to the naked-eye dynamic range: Neptune at conjunction ≈ 2",
// Sun ≈ 1920". Outside that, clamp. Result rounded to integer px.
const MARKER_MIN_PX = 4;
const MARKER_MAX_PX = 15;
const LOG_MIN = Math.log10(2);     // Neptune-class
const LOG_MAX = Math.log10(1920);  // Sun-class
const LOG_SPAN = LOG_MAX - LOG_MIN;
const PX_SPAN = MARKER_MAX_PX - MARKER_MIN_PX;

export function markerSizePx(name, distanceAu) {
  const arcsec = apparentArcsec(name, distanceAu);
  if (arcsec == null) return null;
  const logVal = Math.log10(Math.max(arcsec, 0.01));
  const t = Math.max(0, Math.min(1, (logVal - LOG_MIN) / LOG_SPAN));
  return Math.round(MARKER_MIN_PX + t * PX_SPAN);
}

export function projectPlanets(planets, width, height) {
  return planets.map((p) => {
    const { x, y } = projectAltAz(p, width, height);
    const name = titleCasePlanetName(p.name);
    const displaySize = markerSizePx(name, p.distance_au);
    return {
      kind: "planet",
      id: `planet:${name}`,
      name,
      displaySize,
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

export function projectConstellations(constellations, width, height) {
  if (!constellations || !constellations.length || !width || !height) {
    return { lines: [], labels: [] };
  }

  const lines = [];
  const labels = [];

  for (const c of constellations) {
    for (const seg of c.segments) {
      if (!seg.visible) continue;
      const a = projectAltAz({ alt: seg.from_alt, az: seg.from_az }, width, height);
      const b = projectAltAz({ alt: seg.to_alt, az: seg.to_az }, width, height);
      lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    if (c.label_visible) {
      const p = projectAltAz({ alt: c.label_alt, az: c.label_az }, width, height);
      labels.push({ id: c.id, name: c.name, x: p.x, y: p.y });
    }
  }

  return { lines, labels };
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
