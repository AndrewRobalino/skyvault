/**
 * Attribution footer. Primary line lists data sources; secondary line
 * credits the Milky Way background image.
 */
export default function Footer() {
  return (
    <footer className="footer mt-12 border-t border-rule pt-6 text-center font-mono uppercase tracking-[0.2em] text-[11px] text-ink-dim">
      <div className="text-accent-dim">
        POWERED BY ESA GAIA DR3 · NASA JPL · IAU · ESO
      </div>
      <div className="mt-2 text-[10px] tracking-[0.15em] text-ink-dim/70">
        Milky Way: ESO/S. Brunier · CC-BY 4.0
      </div>
    </footer>
  );
}
