import ExploreIn3DButton from "./ExploreIn3DButton.jsx";

/**
 * Reserved 16:9 slot for the Canvas 2D sky chart (Phase 2b).
 * In Phase 2a it holds a "coming soon" placeholder + 3D button stub.
 */
export default function HeroRegion() {
  return (
    <section className="hero relative aspect-[4/3] w-full overflow-hidden border border-rule bg-bg/80 md:aspect-[16/9]">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent-dim">
          Interactive Sky Chart
        </p>
        <p className="font-serif italic text-ink text-xl md:text-2xl">
          Arrives next session
        </p>
        <ExploreIn3DButton />
      </div>
    </section>
  );
}
