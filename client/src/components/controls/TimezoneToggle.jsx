import { useObserverStore } from "../../stores/observerStore.js";

export default function TimezoneToggle() {
  const { timezone, setTimezone } = useObserverStore();

  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-[0.25em] text-ink-dim mb-1">
        TZ
      </label>
      <div className="inline-flex border border-rule">
        {["Local", "UTC"].map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setTimezone(opt)}
            className={`px-3 py-3 font-mono text-xs uppercase tracking-widest ${
              timezone === opt
                ? "bg-accent/20 text-accent"
                : "text-ink-dim hover:text-ink"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
