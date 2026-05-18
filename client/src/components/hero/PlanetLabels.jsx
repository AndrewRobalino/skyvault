/**
 * Always-on HTML labels for visible planets (Phase 2c).
 *
 * Filters to alt > 0 (above horizon). Each label sits at +10/-6 offset
 * from the planet marker, flipped to the left when the planet is in the
 * right 20% of the canvas to avoid clipping.
 */
export default function PlanetLabels({ projectedPlanets, width }) {
  const flipThreshold = width * 0.8;

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {projectedPlanets
        .filter((p) => p.alt > 0)
        .map((p) => {
          const flip = p.x > flipThreshold;
          const left = flip ? p.x - 10 : p.x + 10;
          const top = p.y - 6;
          return (
            <span
              key={p.id ?? p.name}
              style={{
                position: "absolute",
                left: `${left}px`,
                top: `${top}px`,
                transform: flip ? "translateX(-100%)" : "none",
                textAlign: flip ? "right" : "left",
                fontSize: "11px",
                letterSpacing: "0.04em",
                color: "rgba(255, 255, 255, 0.75)",
                textShadow: "0 0 4px rgba(0, 0, 0, 0.8)",
                whiteSpace: "nowrap",
              }}
            >
              {p.name}
            </span>
          );
        })}
    </div>
  );
}
