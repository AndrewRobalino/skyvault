export default function SelectionRing({ object, variant = "hover" }) {
  if (!object) return null;

  const baseSize = object.kind === "planet" ? 28 : 22;
  const opacity = variant === "selected" ? 0.85 : 0.45;
  const borderColor =
    variant === "selected"
      ? `rgba(232, 184, 109, ${opacity})`
      : `rgba(220, 225, 240, ${opacity})`;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute rounded-full"
      style={{
        left: object.x - baseSize / 2,
        top: object.y - baseSize / 2,
        width: baseSize,
        height: baseSize,
        border: `1px solid ${borderColor}`,
        boxShadow:
          variant === "selected"
            ? `0 0 12px 2px rgba(232, 184, 109, 0.25)`
            : undefined,
        transition: "opacity 120ms ease, transform 120ms ease",
      }}
    />
  );
}
