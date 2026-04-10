/**
 * Small attribution chip. Rendered on every info row.
 */
export default function SourceBadge({ source, identifier }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-accent-dim">
      {source}
      {identifier ? ` · ${identifier}` : ""}
    </span>
  );
}
