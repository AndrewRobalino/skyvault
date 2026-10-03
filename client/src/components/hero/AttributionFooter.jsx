/**
 * On-chart attribution.
 *
 * LICENSE NOTICE: The Milky Way panorama (eso0932a, GigaGalaxy Zoom Project)
 * is © ESO/S. Brunier, licensed under CC BY 4.0, and is credited on the
 * image itself. Everything else is credited in the page footer's full list
 * (#credits, see layout/Footer.jsx); this badge links there. It used to list
 * all seven sources here, which covered a large part of a phone-sized chart.
 */
export default function AttributionFooter() {
  return (
    <div
      className="absolute bottom-2 left-3 select-none text-[10px] leading-snug tracking-[0.03em] text-white/50"
    >
      <div>Milky Way: ESO/S. Brunier · CC BY 4.0</div>
      <a
        href="#credits"
        // The chart underneath hit-tests every click.
        onClick={(e) => e.stopPropagation()}
        className="underline decoration-white/30 underline-offset-2 hover:text-white/80"
      >
        Data credits
      </a>
    </div>
  );
}
