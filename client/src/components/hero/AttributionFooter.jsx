/**
 * Persistent attribution badge for the sky chart.
 *
 * LICENSE NOTICE: Includes credit for the Mellinger 2.0 panorama
 * (© Axel Mellinger), which is required by its non-commercial license.
 * DO NOT remove the Mellinger line without first removing the
 * mellinger_2_galactic.webp asset and the MilkyWayBackdrop layer.
 *
 * See: ~/.claude/projects/.../memory/skyvault_mellinger_license.md
 */
export default function AttributionFooter() {
  return (
    <div
      className="absolute bottom-2 right-3 pointer-events-none select-none"
      style={{
        fontSize: "10px",
        color: "rgba(255, 255, 255, 0.5)",
        letterSpacing: "0.03em",
        lineHeight: 1.4,
        textAlign: "right",
      }}
    >
      <div>Milky Way panorama © Axel Mellinger</div>
      <div>Stars: ESA Gaia DR3 · Planets: NASA JPL DE421</div>
    </div>
  );
}
