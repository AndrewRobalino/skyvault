import ExploreIn3DButton from "./ExploreIn3DButton.jsx";
import SkyChart from "./SkyChart.jsx";

export default function HeroRegion() {
  return (
    <section
      className="
        relative w-full overflow-hidden border border-rule bg-bg/80
        h-[min(56.25vw,calc(100vh-14rem))]
        min-h-[260px]
      "
    >
      <SkyChart />

      <div className="absolute bottom-4 right-4 z-10 pointer-events-auto">
        <ExploreIn3DButton />
      </div>
    </section>
  );
}
