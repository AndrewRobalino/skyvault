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
import { getTexture } from "./textureCache.js";

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

// Planet marker sizes (diameter, px) — Phase 2c bumped for differentiation.
export const PLANET_SIZES = {
  Sun: 16,
  Moon: 16,
  Venus: 16,
  Jupiter: 16,
  Mars: 14,
  Mercury: 13,
  Saturn: 13,
  Uranus: 13,
  Neptune: 13,
};

const PLANET_SIZE_DEFAULT = 13;

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

// Sun gets a warmer disc distinct from nighttime planets.
const SUN_CORE = "#fff4c8";
const SUN_MID = "#ffd890";

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

  const size = PLANET_SIZES[planet.name] ?? PLANET_SIZE_DEFAULT;
  const tint = PLANET_TINTS[planet.name] ?? PLANET_TINT_DEFAULT;
  const { x, y } = planet;
  const r = size / 2;
  const textureUrl = PLANET_TEXTURE_URLS[planet.name];

  ctx.save();

  // Outer glow ring — unchanged, keeps the planet visually distinct from stars.
  const glowRadius = r * 1.5;
  const glowGradient = ctx.createRadialGradient(x, y, r * 0.9, x, y, glowRadius);
  glowGradient.addColorStop(0, hexToRgba(tint, 0.35));
  glowGradient.addColorStop(1, hexToRgba(tint, 0));
  ctx.fillStyle = glowGradient;
  ctx.beginPath();
  ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  const img = textureUrl ? getTexture(textureUrl) : null;
  if (img && img.complete && img.naturalWidth > 0) {
    // Clip to a circle so the rectangular texture renders as a disk.
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, x - r, y - r, size, size);
    ctx.restore();
  } else {
    // Fallback while the texture loads.
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
  const size = PLANET_SIZES.Sun;
  const halo = size * 2.5;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, halo);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(size / halo, SUN_CORE);
  gradient.addColorStop(0.7, SUN_MID);
  gradient.addColorStop(1, "rgba(255, 216, 144, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, halo, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMoon(ctx, planet) {
  const { x, y, illumination } = planet;
  const size = PLANET_SIZES.Moon;
  const r = size / 2;
  const frac = illumination ?? 1.0;

  // Filled disc.
  ctx.save();
  ctx.fillStyle = "#e8e3d6";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Shadow arc representing the unlit fraction.
  if (frac < 0.98) {
    ctx.fillStyle = "rgba(5, 6, 13, 0.8)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    const shadowWidth = r * 2 * (1 - frac);
    ctx.ellipse(
      x + r - shadowWidth / 2,
      y,
      shadowWidth / 2,
      r,
      0,
      0,
      Math.PI * 2,
      true
    );
    ctx.fill("evenodd");
  }

  // Subtle border.
  ctx.strokeStyle = "rgba(232, 227, 214, 0.4)";
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
