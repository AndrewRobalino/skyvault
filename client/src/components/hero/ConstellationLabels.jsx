/**
 * Constellation name labels (Phase 3a). DOM overlay mirroring PlanetLabels /
 * CardinalLabels. Non-interactive ambient context — dimmer and smaller than
 * planet labels, uppercase with wide letter-spacing.
 *
 * `labels` are pre-projected centroids (visible-only) from projectConstellations.
 */
export default function ConstellationLabels({ labels }) {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {(labels ?? []).map((l) => (
        <span
          key={l.id}
          style={{
            position: "absolute",
            left: `${l.x}px`,
            top: `${l.y}px`,
            transform: "translate(-50%, -50%)",
            fontSize: "9px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(170, 195, 230, 0.45)",
            textShadow: "0 0 4px rgba(0, 0, 0, 0.8)",
            whiteSpace: "nowrap",
          }}
        >
          {l.name}
        </span>
      ))}
    </div>
  );
}
