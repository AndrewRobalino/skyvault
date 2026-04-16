import ErrorCard from "../ui/ErrorCard.jsx";

function errorMessage(error) {
  if (!error) return "Something went wrong.";
  if (error.status === 404 || error.status === 422) {
    return "Location could not be computed.";
  }
  if (error.status >= 500) {
    return "Sky computation failed. Please try again.";
  }
  if (error.status === 0) {
    return "Can't reach the server. Check your connection.";
  }
  return error.message || "Something went wrong.";
}

export default function SkyStatusOverlay({ state, placeName, error, onRetry }) {
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
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-auto">
        <ErrorCard message={errorMessage(error)} onRetry={onRetry} />
      </div>
    );
  }

  return null;
}
