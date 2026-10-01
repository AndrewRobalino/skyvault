import { useObserverStore } from "../../stores/observerStore.js";

const TITLES = {
  Local: (zone) =>
    zone ? `Local time at the selected place (${zone})` : "Local time at the selected place",
  UTC: () => "Coordinated Universal Time",
};

export default function TimezoneToggle() {
  const timezone = useObserverStore((s) => s.timezone);
  const setTimezone = useObserverStore((s) => s.setTimezone);
  const zone = useObserverStore((s) => s.selected?.timezone ?? null);

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
            title={TITLES[opt](zone)}
            aria-pressed={timezone === opt}
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
