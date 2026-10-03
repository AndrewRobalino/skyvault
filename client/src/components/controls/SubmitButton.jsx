import { useObserverStore } from "../../stores/observerStore.js";
import Button from "../ui/Button.jsx";
import { isSupportedDate } from "../../utils/formatDatetime.js";

export default function SubmitButton({ isGeocoding, isComputing }) {
  const rawQuery = useObserverStore((s) => s.rawQuery);
  const date = useObserverStore((s) => s.date);
  const submit = useObserverStore((s) => s.submit);
  const selected = useObserverStore((s) => s.selected);
  // A GPS fix leaves the search box empty but is still a place to compute for.
  const hasPlace = Boolean(selected) || (rawQuery && rawQuery.length >= 2);
  const disabled = !hasPlace || !isSupportedDate(date);

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
