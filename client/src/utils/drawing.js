/**
 * Canvas drawing helpers for the sky chart.
 *
 * Pure functions: magnitudeToGlow (data → render spec).
 * Canvas operations (drawStar, drawPlanet) are added in a later task;
 * they receive a 2D context and are not pure, but their size/color
 * inputs come from magnitudeToGlow + bvToHex.
 */

import { bvToHex } from "./bvToColor.js";
import { horizonHaze } from "./horizonHaze.js";
import { PLANET_ICONS, drawMoonIcon } from "./planetIcons.js";

/**
 * Color amplification factor for star halos.
 *
 *   mag ≤ 1.5 → 1.0 (full BP-RP color: Vega blue, Betelgeuse orange)
 *   mag ≥ 6   → 0.0 (near-white; eye can't resolve color at very dim mags)
 *   linear interpolation between
 */
export function colorAmpFactor(magnitude) {
  if (magnitude <= 1.5) return 1.0;
  if (magnitude >= 6) return 0.0;
  return 1 - (magnitude - 1.5) / 4.5;
}

/**
 * Calibration stops: [magnitude breakpoint, core radius px, halo radius px].
 *
 * Stellarium-style point rendering: only the ~30 brightest stars (mag ≤ 2)
 * get a visible glow halo. Everything dimmer is a tiny anti-aliased dot,
 * so dense star fields don't blob together under additive blending.
 */
const STAR_GLOW_STOPS = [
  [-1.5, 1.8, 10],  // Sirius-tier: notable bloom
  [0, 1.5, 6],      // Vega-class
  [1, 1.2, 3],      // Polaris/Arcturus-class — small halo
  [2, 1.0, 0],      // halo cutoff — just a bright dot from here
  [3, 0.85, 0],
  [4, 0.7, 0],
  [5, 0.6, 0],
  [6, 0.5, 0],
];

const DIM_TIER = { core: 0.5, halo: 0 }; // mag > 6 or invalid

export function magnitudeToGlow(mag) {
  if (mag == null || !Number.isFinite(mag)) return { ...DIM_TIER };
  if (mag > 6) return { ...DIM_TIER };
  if (mag <= STAR_GLOW_STOPS[0][0]) {
    return { core: STAR_GLOW_STOPS[0][1], halo: STAR_GLOW_STOPS[0][2] };
  }

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

// Logarithmically-scaled marker diameters (px). The Sun caps at 15px and
// every other body sizes down by log(d / d_moon) / log(d_sun / d_moon),
// then maps onto [4, 15]. Linear scaling breaks at this dynamic range —
// the Sun is 285× wider than Mercury, so a 15px Sun would put Mercury at
// 0.05px. Log compression preserves "bigger is bigger" while keeping
// every body clickable. Real diameters from IAU/NASA fact sheets.
export const PLANET_SIZES = {
  Sun: 15,
  Jupiter: 11,
  Saturn: 10,
  Uranus: 9,
  Neptune: 9,
  Venus: 6,
  Mars: 5,
  Mercury: 5,
  Moon: 4,
};

const PLANET_SIZE_DEFAULT = 5;

// Per-planet color tints — drawn from observed planetary colors
// (real telescope/photo references). NOT amber-everywhere.
export const PLANET_TINTS = {
  Mars: "#d97a4a",
  Venus: "#f5e8c0",
  Jupiter: "#e8c98a",
  Saturn: "#c9a86a",
  Mercury: "#b8a890",
  Uranus: "#8eb5c4",
  Neptune: "#6a8cb4",
};

const PLANET_TINT_DEFAULT = "#e8c98a";

export const PLANET_TEXTURE_URLS = {
  Mercury: "/textures/planets/mercury.jpg",
  Venus:   "/textures/planets/venus.jpg",
  Mars:    "/textures/planets/mars.jpg",
  Jupiter: "/textures/planets/jupiter.jpg",
  Saturn:  "/textures/planets/saturn.jpg",
  Uranus:  "/textures/planets/uranus.jpg",
  Neptune: "/textures/planets/neptune.jpg",
  Moon:    "/textures/planets/moon.jpg",
};

export function drawStar(ctx, star) {
  const { x, y, magnitude, bp_rp, alt } = star;
  const { core, halo } = magnitudeToGlow(magnitude);
  const baseColor = bvToHex(bp_rp);

  // Color amplification: blend toward white for dim stars.
  const amp = colorAmpFactor(magnitude);
  const color = blendHex(baseColor, "#ffffff", 1 - amp);

  // Horizon haze: dim and warm-shift stars near the horizon.
  const { brightnessMul, redShift } = horizonHaze(alt ?? 90);
  const haloColor = blendHex(color, "#ffaa66", redShift);
  const coreAlpha = brightnessMul;

  // Anti-aliased point path: when there's no halo, or when interpolation has
  // shrunk the halo below the core (Canvas gradient stops must be in [0, 1],
  // so core/halo > 1 is invalid). Tiny filled circle, no gradient.
  if (halo === 0 || halo <= core) {
    ctx.fillStyle = hexToRgba(haloColor, coreAlpha);
    ctx.beginPath();
    ctx.arc(x, y, core, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, halo);
  gradient.addColorStop(0, `rgba(255, 255, 255, ${coreAlpha})`);
  gradient.addColorStop(core / halo, hexToRgba(haloColor, 0.85 * coreAlpha));
  gradient.addColorStop(1, hexToRgba(haloColor, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, halo, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function blendHex(hexA, hexB, t) {
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `#${toHex2(r)}${toHex2(g)}${toHex2(bl)}`;
}

function parseHex(hex) {
  const m = /^#?([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})$/.exec(hex);
  if (!m) return { r: 255, g: 255, b: 255 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function toHex2(n) {
  return n.toString(16).padStart(2, "0");
}

export function drawPlanet(ctx, planet) {
  if (planet.name === "Moon") {
    drawMoon(ctx, planet);
    return;
  }
  if (planet.name === "Sun") {
    drawSun(ctx, planet);
    return;
  }

  const size = planet.displaySize ?? PLANET_SIZES[planet.name] ?? PLANET_SIZE_DEFAULT;
  const tint = PLANET_TINTS[planet.name] ?? PLANET_TINT_DEFAULT;
  const { x, y } = planet;
  const r = size / 2;

  ctx.save();

  // Outer glow ring — keeps the planet visually distinct from stars.
  const glowRadius = r * 1.5;
  const glowGradient = ctx.createRadialGradient(x, y, r * 0.9, x, y, glowRadius);
  glowGradient.addColorStop(0, hexToRgba(tint, 0.35));
  glowGradient.addColorStop(1, hexToRgba(tint, 0));
  ctx.fillStyle = glowGradient;
  ctx.beginPath();
  ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  // Procedural body — stylized icon per planet (Jupiter banded, Saturn ringed,
  // Mars with polar caps, etc). Photo textures don't read at this scale and
  // live in the tooltip thumbnail instead.
  const drawIcon = PLANET_ICONS[planet.name];
  if (drawIcon) {
    drawIcon(ctx, x, y, r);
  } else {
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Thin bright edge for crisp definition.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawSun(ctx, planet) {
  const { x, y } = planet;
  const size = planet.displaySize ?? PLANET_SIZES.Sun;
  const r = size / 2;
  const glowRadius = r * 1.6;

  ctx.save();

  // Warmer outer corona — leans more orange than the planet glows.
  const glowGradient = ctx.createRadialGradient(x, y, r * 0.9, x, y, glowRadius);
  glowGradient.addColorStop(0, "rgba(255, 188, 96, 0.65)");
  glowGradient.addColorStop(1, "rgba(255, 188, 96, 0)");
  ctx.fillStyle = glowGradient;
  ctx.beginPath();
  ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  // Disk with real limb darkening: bright white core, deepens to amber
  // then a hot orange-red rim. Reads as a fiery sphere, not a flat dot.
  const diskGradient = ctx.createRadialGradient(x, y, 0, x, y, r);
  diskGradient.addColorStop(0, "#ffffff");
  diskGradient.addColorStop(0.45, "#fff0b8");
  diskGradient.addColorStop(0.85, "#ffae54");
  diskGradient.addColorStop(1, "#d6661c");
  ctx.fillStyle = diskGradient;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Two small sunspots clipped to the disk — adds texture, breaks the
  // "solid yellow ball" read. Real sunspots are dark cooler regions.
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "rgba(72, 28, 8, 0.55)";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.32, y - r * 0.12, r * 0.14, r * 0.10, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + r * 0.22, y + r * 0.28, r * 0.11, r * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Warm rim stroke seals the limb.
  ctx.strokeStyle = "rgba(255, 160, 80, 0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawMoon(ctx, planet) {
  const { x, y, illumination, phase_name } = planet;
  const size = planet.displaySize ?? PLANET_SIZES.Moon;
  const r = size / 2;
  const frac = illumination ?? 1.0;
  const isWaning =
    typeof phase_name === "string" &&
    (phase_name.startsWith("waning") || phase_name === "last quarter");

  ctx.save();

  // Soft outer halo — the gentle glow you see around the moon in dark sky.
  const haloR = r * 1.35;
  const haloGrad = ctx.createRadialGradient(x, y, r * 0.9, x, y, haloR);
  haloGrad.addColorStop(0, "rgba(248, 240, 220, 0.22)");
  haloGrad.addColorStop(1, "rgba(248, 240, 220, 0)");
  ctx.fillStyle = haloGrad;
  ctx.beginPath();
  ctx.arc(x, y, haloR, 0, Math.PI * 2);
  ctx.fill();

  if (frac >= 0.98) {
    drawMoonIcon(ctx, x, y, r);
  } else if (frac <= 0.02) {
    // New moon — solid dark disk.
    ctx.fillStyle = "#15171f";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Dark hemisphere base — solid (no maria leak through transparency).
    ctx.fillStyle = "#15171f";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Lit-region path:
    //   Outer: half of the disk on the lit side (RIGHT waxing, LEFT waning)
    //   Inner: half of the terminator ellipse (same side for crescent,
    //          opposite for gibbous so the lit region wraps the center)
    // Canvas y-down sweep directions:
    //   Outer top→bottom: CCW=false through RIGHT, CCW=true through LEFT
    //   Inner bottom→top: CCW=true through RIGHT, CCW=false through LEFT
    const isCrescent = frac < 0.5;
    const rx = r * Math.abs(1 - 2 * frac);
    const litDiskRight = !isWaning;
    const litTermRight = isCrescent ? litDiskRight : !litDiskRight;
    const outerCCW = !litDiskRight;
    const innerCCW = litTermRight;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2, outerCCW);
    if (innerCCW) {
      ctx.ellipse(x, y, rx, r, 0, Math.PI / 2, -Math.PI / 2, true);
    } else {
      ctx.ellipse(x, y, rx, r, 0, Math.PI / 2, 3 * Math.PI / 2, false);
    }
    ctx.closePath();
    ctx.clip();

    drawMoonIcon(ctx, x, y, r);
    ctx.restore();
  }

  ctx.strokeStyle = "rgba(232, 227, 214, 0.45)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Small utility: hex "#rrggbb" + alpha → "rgba(r,g,b,a)"
function hexToRgba(hex, alpha) {
  const m = /^#?([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})$/.exec(hex);
  if (!m) return `rgba(255,255,255,${alpha})`;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}
