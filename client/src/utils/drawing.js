/**
 * Canvas drawing helpers for the sky chart.
 *
 * Pure functions: magnitudeToGlow (data → render spec).
 * Canvas operations (drawStar, drawPlanet) are added in a later task;
 * they receive a 2D context and are not pure, but their size/color
 * inputs come from magnitudeToGlow + bvToHex.
 */

import { bvToHex } from "./bvToColor.js";

// Calibration stops: [magnitude breakpoint, core px, halo px]
const STAR_GLOW_STOPS = [
  [0, 3.0, 18],
  [2, 2.5, 12],
  [4, 2.0, 6],
  [6, 1.5, 3],
];

const DIM_TIER = { core: 1.0, halo: 0 }; // mag > 6 or invalid

export function magnitudeToGlow(mag) {
  if (mag == null || !Number.isFinite(mag)) return { ...DIM_TIER };
  if (mag > 6) return { ...DIM_TIER };
  if (mag <= 0) return { core: STAR_GLOW_STOPS[0][1], halo: STAR_GLOW_STOPS[0][2] };

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

// Planet marker sizes (diameter, px)
const PLANET_SIZES = {
  Sun: 16,
  Moon: 16,
  Venus: 12,
  Jupiter: 12,
  Mars: 11,
  Mercury: 10,
  Saturn: 10,
  Uranus: 10,
  Neptune: 10,
};

const PLANET_SIZE_DEFAULT = 10;

// Amber planet tint (matches Phase 2a accent theme).
const PLANET_CORE = "#ffd890";
const PLANET_MID = "#e8a968";
const PLANET_BORDER = "rgba(255, 216, 144, 0.4)";

// Sun gets a warmer disc distinct from nighttime planets.
const SUN_CORE = "#fff4c8";
const SUN_MID = "#ffd890";

export function drawStar(ctx, star) {
  const { x, y, magnitude, bp_rp } = star;
  const { core, halo } = magnitudeToGlow(magnitude);
  const color = bvToHex(bp_rp);

  if (halo === 0) {
    // Dim star: single pixel, no gradient.
    ctx.fillStyle = color;
    ctx.fillRect(x - core / 2, y - core / 2, core, core);
    return;
  }

  // Bright star: white core + tinted halo gradient.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, halo);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(core / halo, hexToRgba(color, 0.85));
  gradient.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, halo, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
  const { x, y } = planet;
  const halo = size * 2;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, halo);
  gradient.addColorStop(0, PLANET_CORE);
  gradient.addColorStop(size / halo, PLANET_MID);
  gradient.addColorStop(1, "rgba(232, 169, 104, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, halo, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Bordered ring on the disc itself.
  ctx.save();
  ctx.strokeStyle = PLANET_BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
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
