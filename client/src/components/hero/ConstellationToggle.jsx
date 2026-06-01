import { useUiStateStore } from "../../stores/uiStateStore.js";

/**
 * View toggle for the constellation overlay. Dark-chrome aesthetic, sits over
 * the sky chart. Off by default (immersive sky is the hero).
 */
export default function ConstellationToggle() {
  const showConstellations = useUiStateStore((s) => s.showConstellations);
  const toggle = useUiStateStore((s) => s.toggleConstellations);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={showConstellations}
      aria-label="Toggle constellations"
      className={[
        "absolute top-3 right-3 z-10 rounded-md border px-2.5 py-1",
        "font-mono text-[10px] uppercase tracking-[0.18em] select-none",
        "backdrop-blur-sm transition-colors",
        showConstellations
          ? "border-accent-dim/60 text-accent-dim bg-white/5"
          : "border-white/10 text-white/40 bg-black/20 hover:text-white/70",
      ].join(" ")}
    >
      Constellations
    </button>
  );
}
