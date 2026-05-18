export default function CardinalLabels() {
  const cls =
    "absolute font-mono text-[10px] uppercase tracking-[0.25em] text-accent-dim/80 pointer-events-none select-none";
  return (
    <>
      <span className={`${cls} left-1/2 top-3 -translate-x-1/2`}>N</span>
      <span className={`${cls} left-1/2 bottom-3 -translate-x-1/2`}>S</span>
      <span className={`${cls} right-3 top-1/2 -translate-y-1/2`}>E</span>
      <span className={`${cls} left-3 top-1/2 -translate-y-1/2`}>W</span>
    </>
  );
}
