import { useObserverStore } from "../../stores/observerStore.js";

export default function DidYouMeanDropdown() {
  const { candidates, selectCandidate } = useObserverStore();
  if (!candidates || candidates.length === 0) return null;

  return (
    <div className="mt-2 border border-accent-dim/50 bg-[color:var(--bg-panel)] backdrop-blur-sm">
      <div className="border-b border-rule px-4 py-2 font-mono text-[11px] uppercase tracking-[0.25em] text-accent">
        Did you mean
      </div>
      <ul>
        {candidates.map((c, idx) => (
          <li key={`${c.osm_id || idx}-${c.display_name}`}>
            <button
              type="button"
              onClick={() => selectCandidate(idx)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/10"
            >
              <span className="font-serif italic text-ink">{c.display_name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
