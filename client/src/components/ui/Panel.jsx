/**
 * Reusable panel primitive. Semi-transparent dark backdrop, thin rule
 * border, optional `title` rendered in mono amber.
 *
 * Carries the `.panel` class so the global idle-state CSS rules apply.
 */
export default function Panel({ title, children, className = "" }) {
  return (
    <section
      className={`panel border border-rule bg-[color:var(--bg-panel)] backdrop-blur-sm p-6 ${className}`}
    >
      {title && (
        <header className="mb-4 font-mono text-[11px] uppercase tracking-[0.25em] text-accent">
          {title}
        </header>
      )}
      {children}
    </section>
  );
}
