import ExploreIn3DButton from "./ExploreIn3DButton.jsx";
import SkyChart from "./SkyChart.jsx";

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

      {/* A disabled placeholder; on phones it would cover a quarter of the sky. */}
      <div className="absolute bottom-4 right-4 z-10 pointer-events-auto hidden md:block">
        <ExploreIn3DButton />
      </div>
    </section>
  );
}
