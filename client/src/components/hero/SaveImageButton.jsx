import { useState } from "react";

/**
 * Downloads a clean PNG snapshot of the current sky (see utils/snapshot.js).
 * Sits beside the Constellations toggle and shares its quiet chrome.
 */
export default function SaveImageButton({ onSave }) {
  const [saving, setSaving] = useState(false);

  const handleClick = async (e) => {
    // The chart underneath treats every click as a hit-test.
    e.stopPropagation();
    if (saving) return;
    setSaving(true);
    try {
      await onSave();
    } catch (err) {
      console.warn("[SaveImage] Export failed:", err?.message ?? err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={saving}
      aria-busy={saving}
      title="Download this sky as a PNG"
      className="rounded-md border border-white/10 bg-black/20 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40 backdrop-blur-sm transition-colors select-none hover:text-white/70 disabled:cursor-wait disabled:opacity-60"
    >
      {saving ? "Saving…" : "Save image"}
    </button>
  );
}
