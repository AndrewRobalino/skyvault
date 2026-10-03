/**
 * Shared button primitive.
 *   variant="primary" — amber accent, uppercase mono (submit)
 *   variant="ghost"   — transparent with accent border
 */
export default function Button({
  children,
  variant = "primary",
  disabled = false,
  type = "button",
  onClick,
  className = "",
  ...rest
}) {
  const base =
    "font-mono text-[12px] uppercase tracking-[0.2em] px-5 py-3 border transition-colors duration-200";
  const variants = {
    primary:
      "border-accent text-accent hover:bg-accent hover:text-bg disabled:opacity-40 disabled:cursor-not-allowed",
    ghost:
      "border-accent-dim text-ink-dim hover:border-accent hover:text-accent",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
