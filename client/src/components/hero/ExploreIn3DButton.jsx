import Button from "../ui/Button.jsx";

/**
 * Disabled stub button that promises the Three.js Explore Mode.
 * Phase 4 unlocks this and routes it somewhere real.
 */
export default function ExploreIn3DButton() {
  return (
    <div className="flex flex-col items-center gap-2">
      <Button variant="disabled" disabled title="Coming in a future phase">
        EXPLORE IN 3D
      </Button>
      <span className="font-mono text-[10px] uppercase tracking-widest text-accent-dim">
        coming soon
      </span>
    </div>
  );
}
