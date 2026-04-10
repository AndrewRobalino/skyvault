/**
 * Phase-accurate 2D moon illustration.
 *
 * Rendered by computing the terminator as an elliptical arc whose horizontal
 * radius is |cos(phase_angle)| of the moon's radius, combined with either
 * a full half-circle (waxing -> right half lit, waning -> left half lit).
 *
 * phaseAngle: 0 = full, 90 = quarter, 180 = new
 * waxing: true -> waxing (right side illuminated in Northern Hemisphere)
 */
export default function MoonSvg({ phaseAngle, phaseName, size = 120 }) {
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

  const waxing = (phaseName || "").startsWith("waxing");
  const isFull = phaseAngle < 7;
  const isNew = phaseAngle > 173;

  const bright = "#f4ecd8";
  const dark = "#1a1f33";

  if (isNew) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={r} cy={r} r={r - 1} fill={dark} stroke="#3a3f55" />
      </svg>
    );
  }
  if (isFull) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={r} cy={r} r={r - 1} fill={bright} stroke="#888" />
      </svg>
    );
  }

  const isGibbous = phaseAngle < 90;
  const sweepSign = waxing ? 0 : 1;

  if (isGibbous) {
    const darkSide = waxing ? "left" : "right";
    const pathD =
      darkSide === "left"
        ? `M ${r},0 A ${r},${r} 0 0 0 ${r},${size} A ${rx},${r} 0 0 ${sweepSign} ${r},0 Z`
        : `M ${r},0 A ${r},${r} 0 0 1 ${r},${size} A ${rx},${r} 0 0 ${sweepSign} ${r},0 Z`;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={r} cy={r} r={r - 1} fill={bright} stroke="#888" />
        <path d={pathD} fill={dark} />
      </svg>
    );
  }

  // Crescent
  const brightSide = waxing ? "right" : "left";
  const pathD =
    brightSide === "right"
      ? `M ${r},0 A ${r},${r} 0 0 1 ${r},${size} A ${rx},${r} 0 0 ${sweepSign ? 0 : 1} ${r},0 Z`
      : `M ${r},0 A ${r},${r} 0 0 0 ${r},${size} A ${rx},${r} 0 0 ${sweepSign ? 0 : 1} ${r},0 Z`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={r} cy={r} r={r - 1} fill={dark} stroke="#3a3f55" />
      <path d={pathD} fill={bright} />
    </svg>
  );
}
