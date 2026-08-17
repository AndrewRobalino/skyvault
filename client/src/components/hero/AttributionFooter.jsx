/**
 * Persistent attribution badge for the sky chart.
 *
 * LICENSE NOTICE: The Milky Way panorama (eso0932a, GigaGalaxy Zoom Project)
 * is © ESO/S. Brunier, licensed under CC BY 4.0. Attribution is required
 * wherever the image is displayed. The short on-chart credit lives here;
 * the long-form credit + license URL goes on /about.
 *
 * See: ~/.claude/projects/.../memory/skyvault_eso_license.md
 */
export default function AttributionFooter() {
  return (
    <div
      className="absolute bottom-2 left-3 pointer-events-none select-none"
      style={{
        fontSize: "10px",
        color: "rgba(255, 255, 255, 0.5)",
        letterSpacing: "0.03em",
        lineHeight: 1.4,
        textAlign: "left",
      }}
    >
      <div>Milky Way: ESO/S. Brunier · CC BY 4.0</div>
      <div>Stars: ESA Gaia DR3 · Planets: NASA JPL DE421</div>
      <div>Planet &amp; Moon textures: Solar System Scope · CC BY 4.0</div>
      <div>DSO &amp; star names: SIMBAD/CDS</div>
      <div>Exoplanets: NASA Exoplanet Archive</div>
      <div>Constellation figures: Stellarium · CC BY-SA</div>
    </div>
  );
}
