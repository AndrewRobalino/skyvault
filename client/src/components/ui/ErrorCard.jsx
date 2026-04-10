/**
 * Panel-scoped error display. Doesn't take over the whole app — lives
 * inside whichever parent triggered the error.
 */
export default function ErrorCard({ title = "Something went wrong", message, onRetry }) {
  return (
    <div className="border border-danger/40 bg-danger/5 p-4 text-ink-dim">
      <p className="font-mono text-xs uppercase tracking-widest text-danger">
        {title}
      </p>
      {message && (
        <p className="mt-2 font-serif italic text-sm text-ink">{message}</p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 font-mono text-[11px] uppercase tracking-widest text-accent hover:underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}
