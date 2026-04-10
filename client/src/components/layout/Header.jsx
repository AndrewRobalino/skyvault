import { useObserverStore } from "../../stores/observerStore.js";
import { formatDisplayDatetime } from "../../utils/formatDatetime.js";
import { formatLatLon } from "../../utils/formatCoords.js";

/**
 * Top header with eyebrow, italic serif title, and metadata subhead.
 * All three update live from observerStore after a successful submit.
 */
export default function Header() {
  const { selected, datetimeUtc } = useObserverStore();

  const titlePlace = selected?.displayName
    ? selected.displayName.split(",")[0]
    : null;
  const subhead =
    selected && datetimeUtc
      ? `${formatDisplayDatetime(datetimeUtc)} · ${formatLatLon(
          selected.lat,
          selected.lon
        )}`
      : "Enter a location to begin";

  return (
    <header className="header mb-10 border-b border-rule pb-8 text-center">
      <div className="flex items-center justify-center gap-4">
        <span className="h-px w-16 bg-accent-dim" />
        <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent">
          OBSERVATORIUM · SKYVAULT
        </span>
        <span className="h-px w-16 bg-accent-dim" />
      </div>
      <h1 className="mt-5 font-serif italic text-ink text-[clamp(32px,6vw,58px)] leading-tight">
        {titlePlace ? `The Sky over ${titlePlace}` : "The Sky · SkyVault"}
      </h1>
      <p className="mt-3 font-mono text-xs uppercase tracking-widest text-ink-dim">
        {subhead}
      </p>
    </header>
  );
}
