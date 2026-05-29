/**
 * Procedural per-planet sky-chart icons.
 *
 * Photo textures (Solar System Scope) at 22px collapse to undifferentiated
 * tan/cream/gray disks because equirectangular maps lose all detail when
 * downsampled to a 22-pixel circle. Real planetariums (Stellarium, SkySafari)
 * don't ship photo-real planets in their charts either — they paint stylized
 * icons that survive at small scale. We do the same.
 *
 * Each renderer assumes the caller already drew the outer glow ring (in
 * drawPlanet) and will draw the white edge stroke afterward. Renderers
 * are responsible for the disk body only.
 *
 * Photo textures still ship — they live in the tooltip thumbnail at 64×64,
 * where surface detail actually reads.
 *
 * NOTE: Saturn's ring is iconographic, not physically tilted to JPL DE421
 * ring-plane geometry. Real-time tilt belongs to Phase 4 "Explore in 3D".
 */

function radialShade(ctx, x, y, r, innerColor, outerColor) {
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  grad.addColorStop(0, innerColor);
  grad.addColorStop(1, outerColor);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function withDiskClip(ctx, x, y, r, fn) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  fn();
  ctx.restore();
}

export function drawMercuryIcon(ctx, x, y, r) {
  radialShade(ctx, x, y, r, "#c8b698", "#5e4f3e");
  withDiskClip(ctx, x, y, r, () => {
    ctx.fillStyle = "rgba(36, 28, 20, 0.45)";
    const craters = [
      [-0.42, -0.18, 0.22],
      [ 0.24,  0.30, 0.18],
      [ 0.05, -0.48, 0.12],
      [-0.10,  0.55, 0.10],
    ];
    for (const [dx, dy, cr] of craters) {
      ctx.beginPath();
      ctx.arc(x + dx * r, y + dy * r, cr * r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function drawVenusIcon(ctx, x, y, r) {
  radialShade(ctx, x, y, r, "#fff5d8", "#c9a868");
  // Subtle swirl hint — Venus is mostly featureless clouds.
  withDiskClip(ctx, x, y, r, () => {
    ctx.fillStyle = "rgba(232, 200, 144, 0.35)";
    ctx.beginPath();
    ctx.ellipse(x - r * 0.15, y, r * 0.85, r * 0.18, -0.25, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function drawMarsIcon(ctx, x, y, r) {
  radialShade(ctx, x, y, r, "#e89060", "#8a3a18");
  withDiskClip(ctx, x, y, r, () => {
    // Syrtis Major-ish dark albedo blob, lower-right.
    ctx.fillStyle = "rgba(80, 30, 14, 0.45)";
    ctx.beginPath();
    ctx.ellipse(x + r * 0.20, y + r * 0.10, r * 0.45, r * 0.30, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Polar caps.
    ctx.fillStyle = "rgba(248, 240, 232, 0.92)";
    ctx.beginPath();
    ctx.ellipse(x, y - r * 0.78, r * 0.50, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.82, r * 0.36, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function drawJupiterIcon(ctx, x, y, r) {
  // Base cream so band gaps read cleanly.
  ctx.fillStyle = "#e8c890";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  withDiskClip(ctx, x, y, r, () => {
    // Bands: [normalized vertical center (-1..+1), height_norm, color]
    const bands = [
      [-0.68, 0.18, "#a87650"],
      [-0.38, 0.20, "#f4dca8"],
      [-0.10, 0.16, "#8c5a36"],
      [ 0.18, 0.16, "#f0d098"],
      [ 0.46, 0.18, "#9c6438"],
      [ 0.76, 0.16, "#c8a070"],
    ];
    for (const [cy, h, color] of bands) {
      ctx.fillStyle = color;
      ctx.fillRect(x - r, y + cy * r - (h * r) / 2, r * 2, h * r);
    }

    // Great Red Spot — small oval, lower-left of equator.
    ctx.fillStyle = "rgba(180, 76, 48, 0.75)";
    ctx.beginPath();
    ctx.ellipse(x - r * 0.30, y + r * 0.22, r * 0.18, r * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function drawSaturnIcon(ctx, x, y, r) {
  const ringRX = r * 1.75;
  const ringRY = r * 0.32;
  const ringColor = "rgba(232, 200, 144, 0.80)";
  const ringInnerGap = "rgba(232, 200, 144, 0.35)";

  // Back half of the ring (behind the disk). Drawn first.
  ctx.save();
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(x, y, ringRX, ringRY, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  // Cassini gap suggestion.
  ctx.strokeStyle = ringInnerGap;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(x, y, ringRX * 0.78, ringRY * 0.78, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Disk.
  radialShade(ctx, x, y, r, "#f5dca8", "#a8845c");
  withDiskClip(ctx, x, y, r, () => {
    // Faint equatorial banding.
    ctx.fillStyle = "rgba(168, 132, 92, 0.30)";
    ctx.fillRect(x - r, y - r * 0.18, r * 2, r * 0.36);
    ctx.fillStyle = "rgba(220, 188, 144, 0.25)";
    ctx.fillRect(x - r, y + r * 0.25, r * 2, r * 0.20);
  });

  // Front half of the ring (in front of disk).
  ctx.save();
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(x, y, ringRX, ringRY, 0, 0, Math.PI);
  ctx.stroke();
  ctx.strokeStyle = ringInnerGap;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(x, y, ringRX * 0.78, ringRY * 0.78, 0, 0, Math.PI);
  ctx.stroke();
  ctx.restore();
}

export function drawUranusIcon(ctx, x, y, r) {
  radialShade(ctx, x, y, r, "#d4ecec", "#4a7888");
}

export function drawNeptuneIcon(ctx, x, y, r) {
  radialShade(ctx, x, y, r, "#6e94d8", "#142e68");
  withDiskClip(ctx, x, y, r, () => {
    // Faint dark spot — Neptune's transient storm signature.
    ctx.fillStyle = "rgba(8, 16, 48, 0.55)";
    ctx.beginPath();
    ctx.ellipse(x + r * 0.18, y - r * 0.12, r * 0.20, r * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

/**
 * Procedural Moon disk (no phase shadow — drawMoon in drawing.js layers
 * that on top). Positions four dark maria blobs to evoke the classic
 * "Man in the Moon" pattern visible to the naked eye from Earth:
 *  - Mare Imbrium      (upper left)
 *  - Serenitatis +
 *    Tranquillitatis   (upper right "eye")
 *  - Mare Nubium       (lower center "mouth")
 *  - Mare Fecunditatis (right side)
 * Coordinates are pixel-coordinates (canvas y-down), so "upper" is -y.
 */
export function drawMoonIcon(ctx, x, y, r) {
  const baseGrad = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, 0, x, y, r);
  baseGrad.addColorStop(0, "#ece4d2");
  baseGrad.addColorStop(0.7, "#c4baa6");
  baseGrad.addColorStop(1, "#7e7466");
  ctx.fillStyle = baseGrad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  withDiskClip(ctx, x, y, r, () => {
    ctx.fillStyle = "rgba(58, 52, 46, 0.62)";
    // [nx, ny, rx, ry, rot]  — normalized to r.
    const maria = [
      [-0.28, -0.32, 0.34, 0.24,  0.10],
      [ 0.12, -0.20, 0.26, 0.20, -0.20],
      [-0.08,  0.36, 0.34, 0.22,  0.00],
      [ 0.36,  0.18, 0.22, 0.16,  0.30],
    ];
    for (const [nx, ny, rx, ry, rot] of maria) {
      ctx.beginPath();
      ctx.ellipse(x + nx * r, y + ny * r, rx * r, ry * r, rot, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tycho — small bright impact crater near the south limb.
    ctx.fillStyle = "rgba(255, 250, 235, 0.75)";
    ctx.beginPath();
    ctx.arc(x - r * 0.06, y + r * 0.62, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
  });
}

export const PLANET_ICONS = {
  Mercury: drawMercuryIcon,
  Venus: drawVenusIcon,
  Mars: drawMarsIcon,
  Jupiter: drawJupiterIcon,
  Saturn: drawSaturnIcon,
  Uranus: drawUranusIcon,
  Neptune: drawNeptuneIcon,
};
