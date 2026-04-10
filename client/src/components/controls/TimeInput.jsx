import { useObserverStore } from "../../stores/observerStore.js";

export default function TimeInput() {
  const { time, setTime } = useObserverStore();
  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-[0.25em] text-ink-dim mb-1">
        Time (optional)
      </label>
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="border border-rule bg-bg/60 px-3 py-3 font-mono text-sm text-ink focus:border-accent focus:outline-none"
      />
    </div>
  );
}
