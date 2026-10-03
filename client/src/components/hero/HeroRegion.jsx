import SkyChart from "./SkyChart.jsx";

// Phase 4's "Explore in 3D" entry point goes back here when that mode exists
// (the old disabled placeholder is in git history).
export default function HeroRegion() {
  return (
    <section
      className="
        relative w-full overflow-hidden border border-rule
        aspect-square
        md:aspect-auto md:h-[min(56.25vw,calc(100vh-14rem))] md:min-h-[260px]
      "
    >
      {/* Phones: a full-width square, so the horizon circle fills the box and
          the corners (below the horizon) hold the buttons and credits. */}
      <SkyChart />
    </section>
  );
}
