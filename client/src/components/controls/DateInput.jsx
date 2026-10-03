import { useEffect } from "react";
import { useObserverStore } from "../../stores/observerStore.js";
import { DATE_MAX, DATE_MIN, isSupportedDate } from "../../utils/formatDatetime.js";

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function DateInput() {
  const date = useObserverStore((s) => s.date);
  const setDate = useObserverStore((s) => s.setDate);
  const outOfRange = Boolean(date) && !isSupportedDate(date);

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
        min={DATE_MIN}
        max={DATE_MAX}
        aria-invalid={outOfRange}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="border border-rule bg-bg/60 px-3 py-3 font-mono text-sm text-ink focus:border-accent focus:outline-none"
      />
      {outOfRange && (
        <p role="alert" className="mt-1 font-mono text-[10px] uppercase tracking-widest text-danger">
          Dates {DATE_MIN} to {DATE_MAX} (JPL DE421)
        </p>
      )}
    </div>
  );
}
