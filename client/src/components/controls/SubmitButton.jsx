import { useObserverStore } from "../../stores/observerStore.js";
import Button from "../ui/Button.jsx";

export default function SubmitButton({ isGeocoding, isComputing }) {
  const { rawQuery, date, submit } = useObserverStore();
  const disabled = !rawQuery || rawQuery.length < 2 || !date;

  let label = "GO";
  if (isGeocoding) label = "LOOKING UP...";
  else if (isComputing) label = "COMPUTING SKY...";

  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-[0.25em] text-ink-dim mb-1">
        &nbsp;
      </label>
      <Button
        variant="primary"
        disabled={disabled || isGeocoding || isComputing}
        onClick={() => submit()}
      >
        {label}
      </Button>
    </div>
  );
}
