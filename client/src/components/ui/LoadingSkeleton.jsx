/**
 * Simple pulsing skeleton for panel content while queries are in flight.
 */
export default function LoadingSkeleton({ lines = 3 }) {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 w-full animate-pulse rounded bg-rule/60"
          style={{ width: `${60 + (i % 3) * 15}%` }}
        />
      ))}
    </div>
  );
}
