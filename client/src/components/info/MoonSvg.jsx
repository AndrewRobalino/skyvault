import { useId } from "react";

/**
 * Phase-accurate 2D moon illustration using a real photo of the lunar
 * near-side (Solar System Scope, CC BY 4.0).
 *
 * Visual stack (bottom → top, all inside the disk clip):
 *   1. Photo texture, passed through a contrast/brightness SVG filter so the
 *      maria pop against the highlands instead of reading as a flat tone.
 *   2. Near-black shadow path covering the unlit hemisphere, blurred at the
 *      terminator so the lit/dark transition is soft, not a hard clip.
 *   3. A faint cream stroke along the lit limb, blurred — gives the
 *      "moon glow" that real long-exposure photos pick up at the bright edge.
 *
 * Phase geometry (Northern Hemisphere convention):
 *   Lit disk side  — waxing → RIGHT, waning → LEFT
 *   Lit term side  — crescent → same as lit limb, gibbous → opposite
 *   Dark region    — uses OPPOSITE disk side + SAME terminator side
 *
 * SVG sweep flags (y-down):
 *   Outer top→bottom: sweep=1 traces RIGHT, sweep=0 traces LEFT
 *   Inner bottom→top: sweep=0 traces RIGHT, sweep=1 traces LEFT
 */
const PHOTO_SRC = "/textures/planets/moon.jpg";
const SHADOW_FILL = "rgba(2, 3, 8, 0.97)";
const LIMB_GLOW = "rgba(255, 248, 220, 0.45)";
const STROKE = "rgba(110, 110, 110, 0.6)";
const NEW_MOON_FILL = "#0e1118";

export default function MoonSvg({ phaseAngle, phaseName, size = 120 }) {
  const rawId = useId();
  const sanitized = rawId.replace(/[:]/g, "");
  const clipId = `moon-clip-${sanitized}`;
  const blurId = `moon-blur-${sanitized}`;
  const contrastId = `moon-contrast-${sanitized}`;

  if (phaseAngle == null) {
    return (
      <div
        className="flex items-center justify-center border border-rule"
        style={{ width: size, height: size }}
      >
        <span className="font-mono text-[10px] text-ink-dim">no data</span>
      </div>
    );
  }

  const r = size / 2;
  const phaseRad = (phaseAngle * Math.PI) / 180;
  const rx = Math.abs(r * Math.cos(phaseRad));
  const blurAmount = Math.max(1, size * 0.012);

  const waxing = (phaseName || "").startsWith("waxing");
  const isFull = phaseAngle < 7;
  const isNew = phaseAngle > 173;
  const isCrescent = phaseAngle > 90;

  if (isNew) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={r} cy={r} r={r - 1} fill={NEW_MOON_FILL} stroke={STROKE} />
      </svg>
    );
  }

  let darkPath = null;
  let litLimbPath = null;
  if (!isFull) {
    const litDiskRight = waxing;
    const litTermRight = isCrescent ? litDiskRight : !litDiskRight;
    const darkDiskRight = !litDiskRight;
    const darkTermRight = litTermRight;
    const outerSweep = darkDiskRight ? 1 : 0;
    const innerSweep = darkTermRight ? 0 : 1;
    darkPath =
      `M ${r},0 ` +
      `A ${r},${r} 0 0 ${outerSweep} ${r},${size} ` +
      `A ${rx},${r} 0 0 ${innerSweep} ${r},0 Z`;

    const litLimbSweep = litDiskRight ? 1 : 0;
    litLimbPath = `M ${r},0 A ${r},${r} 0 0 ${litLimbSweep} ${r},${size}`;
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <clipPath id={clipId}>
          <circle cx={r} cy={r} r={r - 1} />
        </clipPath>
        <filter id={blurId} x="-15%" y="-15%" width="130%" height="130%">
          <feGaussianBlur stdDeviation={blurAmount} />
        </filter>
        <filter id={contrastId}>
          <feComponentTransfer>
            <feFuncR type="linear" slope="1.25" intercept="-0.05" />
            <feFuncG type="linear" slope="1.25" intercept="-0.05" />
            <feFuncB type="linear" slope="1.20" intercept="-0.04" />
          </feComponentTransfer>
        </filter>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <image
          href={PHOTO_SRC}
          x={0}
          y={0}
          width={size}
          height={size}
          preserveAspectRatio="xMidYMid slice"
          filter={`url(#${contrastId})`}
        />
        {darkPath && (
          <path d={darkPath} fill={SHADOW_FILL} filter={`url(#${blurId})`} />
        )}
        {litLimbPath && (
          <path
            d={litLimbPath}
            fill="none"
            stroke={LIMB_GLOW}
            strokeWidth={Math.max(1, size * 0.015)}
            filter={`url(#${blurId})`}
          />
        )}
      </g>
      <circle cx={r} cy={r} r={r - 1} fill="none" stroke={STROKE} strokeWidth="1" />
    </svg>
  );
}
