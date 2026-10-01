import ErrorCard from "../ui/ErrorCard.jsx";

function errorContent(error) {
  const status = error?.status;
  if (status === 429) {
    return { title: "Too many requests", message: "Too many requests — give it a minute." };
  }
  // 503 = backend paused (spend cap / emergency stop); 0 = network or CORS
  // failure, which is also what a paused Cloud Run looks like from a browser.
  if (status === 0 || status === 503) {
    return {
      title: "SkyVault's backend is temporarily offline",
      message: "The sky will be back shortly. Try again in a few minutes.",
    };
  }
  if (status === 404 || status === 422) {
    return { title: "Something went wrong", message: "Location could not be computed." };
  }
  if (status >= 500) {
    return { title: "Something went wrong", message: "Sky computation failed. Please try again." };
  }
  return { title: "Something went wrong", message: error?.message || "Something went wrong." };
}

export default function SkyStatusOverlay({ state, placeName, error, onRetry, slow = false }) {
  if (state === "ready") return null;

  const base =
    "absolute inset-0 flex flex-col items-center justify-center gap-3 text-center pointer-events-none";

  if (state === "idle") {
    return (
      <div className={base}>
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent-dim">
          Awaiting observer
        </p>
        <p className="font-serif italic text-ink text-lg md:text-xl">
          Pick a date and location
        </p>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className={`${base} animate-pulse`}>
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent-dim">
          Computing sky
        </p>
        <p className="font-serif italic text-ink text-lg md:text-xl">
          for {placeName || "your location"}
        </p>
        {slow && (
          <p className="max-w-xs font-mono text-[10px] uppercase tracking-[0.2em] text-ink-dim">
            Waking up the observatory — the first load after a quiet period takes a few seconds.
          </p>
        )}
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-auto">
        <ErrorCard {...errorContent(error)} onRetry={onRetry} />
      </div>
    );
  }

  return null;
}
