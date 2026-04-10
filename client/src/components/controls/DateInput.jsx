import { useEffect } from "react";
import { useObserverStore } from "../../stores/observerStore.js";

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function DateInput() {
  const { date, setDate } = useObserverStore();

  useEffect(() => {
    if (!date) setDate(todayIso());
  }, [date, setDate]);

  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-[0.25em] text-ink-dim mb-1">
        Date
      </label>
      <input
        type="date"
        min="1900-01-01"
        max="2100-12-31"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="border border-rule bg-bg/60 px-3 py-3 font-mono text-sm text-ink focus:border-accent focus:outline-none"
      />
    </div>
  );
}
