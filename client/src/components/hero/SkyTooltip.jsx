const TOOLTIP_W = 240;
const ANCHOR_OFFSET = 12;

function formatNumber(n, decimals) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(decimals);
}

function formatLy(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)} ly`;
}

function formatAu(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)} AU`;
}

function formatDeg(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}°`;
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-ink-dim text-xs uppercase tracking-wider">{label}</span>
      <span className="font-mono text-[13px] text-ink">{value}</span>
    </div>
  );
}

function StarBody({ object }) {
  return (
    <>
      <div className="mb-2">
        <p className="text-ink-dim text-[11px] uppercase tracking-[0.18em]">Star</p>
        <p className="font-mono text-[11px] text-ink-dim mt-0.5 break-all">
          Gaia DR3 · {object.source_id}
        </p>
      </div>
      <div className="border-t border-rule/60 pt-2 pb-2">
        <Row label="Magnitude" value={formatNumber(object.magnitude, 2)} />
        <Row label="Color index" value={formatNumber(object.bp_rp, 2)} />
        <Row label="Distance" value={formatLy(object.distance_ly)} />
        <Row label="Altitude" value={formatDeg(object.alt)} />
        <Row label="Azimuth" value={formatDeg(object.az)} />
      </div>
      <div className="border-t border-rule/60 pt-2 font-mono text-[11px] text-accent-dim">
        Source: {object.source}
      </div>
    </>
  );
}

function PlanetBody({ object }) {
  const isMoon = object.name === "Moon";
  return (
    <>
      <div className="mb-2">
        <p className="text-ink text-sm font-medium">{object.name}</p>
      </div>
      <div className="border-t border-rule/60 pt-2 pb-2">
        <Row label="Distance" value={formatAu(object.distance_au)} />
        <Row label="Altitude" value={formatDeg(object.alt)} />
        <Row label="Azimuth" value={formatDeg(object.az)} />
        {isMoon && object.illumination != null && (
          <Row
            label="Illumination"
            value={`${Math.round(object.illumination * 100)}%`}
          />
        )}
        {isMoon && object.phase_name && (
          <Row label="Phase" value={object.phase_name} />
        )}
      </div>
      <div className="border-t border-rule/60 pt-2 font-mono text-[11px] text-accent-dim">
        Source: {object.source}
      </div>
    </>
  );
}

export default function SkyTooltip({ object, container }) {
  if (!object) return null;

  const anchorX = object.x;
  const anchorY = object.y;

  let left = anchorX + ANCHOR_OFFSET;
  let top = anchorY - ANCHOR_OFFSET;

  if (left + TOOLTIP_W > container.width) {
    left = anchorX - ANCHOR_OFFSET - TOOLTIP_W;
  }
  if (top < 0) top = 0;

  return (
    <div
      role="dialog"
      className="
        pointer-events-auto absolute z-20
        rounded-md border border-rule/60 bg-bg/95 backdrop-blur-sm
        p-3 shadow-lg
        animate-[fadeIn_120ms_ease-out]
      "
      style={{ left, top, width: TOOLTIP_W }}
    >
      {object.kind === "star" ? (
        <StarBody object={object} />
      ) : (
        <PlanetBody object={object} />
      )}
    </div>
  );
}
