/**
 * Soft elliptical glow renderer for naked-eye deep-sky objects.
 *
 * Each DSO is drawn at its real angular size (major/minor axis arcmin),
 * scaled to pixels via the chart's current `pxPerArcmin` factor. Rotated by
 * the catalog's position angle (degrees east of north). Color hints by type.
 *
 * Uses additive blending so the glow brightens (not occludes) anything
 * underneath — bright cluster stars in the Pleiades still pop through.
 */

export const DSO_TYPE_COLORS = {
  galaxy:           "rgba(170, 195, 230, 1)",  // pale blue
  nebula:           "rgba(230, 140, 165, 1)",  // pink/red
  open_cluster:     "rgba(245, 245, 230, 1)",  // warm white
  globular_cluster: "rgba(245, 230, 195, 1)",  // pale gold
};

const DEFAULT_COLOR = "rgba(220, 220, 220, 1)";

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} dso - { x, y, type, angular_size_arcmin, minor_axis_arcmin?, position_angle_deg?, pxPerArcmin }
 */
export function drawDso(ctx, dso) {
  const {
    x, y, type,
    angular_size_arcmin,
    minor_axis_arcmin,
    position_angle_deg,
    pxPerArcmin,
  } = dso;

  if (!angular_size_arcmin || !pxPerArcmin) return;

  const color = DSO_TYPE_COLORS[type] ?? DEFAULT_COLOR;
  const majorPx = (angular_size_arcmin * pxPerArcmin) / 2;
  const minorPx = minor_axis_arcmin != null
    ? (minor_axis_arcmin * pxPerArcmin) / 2
    : majorPx;

  // Clamp to keep tiny objects visible and giant ones from dominating.
  const rxClamped = Math.max(2, Math.min(majorPx, 120));
  const ryClamped = Math.max(2, Math.min(minorPx, 120));

  const angleRad = ((position_angle_deg ?? 0) * Math.PI) / 180;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(x, y);
  ctx.rotate(angleRad);

  // Soft radial gradient inside the rotated frame.
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rxClamped, ryClamped));
  gradient.addColorStop(0,    replaceAlpha(color, 0.55));
  gradient.addColorStop(0.55, replaceAlpha(color, 0.25));
  gradient.addColorStop(1,    replaceAlpha(color, 0));

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, rxClamped, ryClamped, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function replaceAlpha(rgba, a) {
  const m = /^rgba?\(([^)]+)\)$/.exec(rgba);
  if (!m) return rgba;
  const parts = m[1].split(",").map((s) => s.trim());
  return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${a})`;
}
