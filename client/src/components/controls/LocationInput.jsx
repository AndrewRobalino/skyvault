import { useObserverStore } from "../../stores/observerStore.js";
import DidYouMeanDropdown from "./DidYouMeanDropdown.jsx";

export default function LocationInput() {
  const { rawQuery, setRawQuery, submit } = useObserverStore();

  return (
    <div className="flex-1 min-w-0">
      <label className="block font-mono text-[10px] uppercase tracking-[0.25em] text-ink-dim mb-1">
        Location
      </label>
      <input
        type="text"
        value={rawQuery}
        onChange={(e) => setRawQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="City, country (e.g., Portoviejo, Ecuador)"
        className="w-full border border-rule bg-bg/60 px-3 py-3 font-serif italic text-ink placeholder:text-ink-dim/70 focus:border-accent focus:outline-none"
      />
      <DidYouMeanDropdown />
    </div>
  );
}
