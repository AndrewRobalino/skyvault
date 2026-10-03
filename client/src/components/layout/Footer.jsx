/**
 * Page footer: the full data-credits list (#credits). The sky chart carries
 * the short on-image Milky Way credit plus a link here.
 *
 * The list itself lives in credits.js (shared with /about).
 */
import { CREDITS } from "./credits.js";

const linkCls = "underline decoration-ink-dim/40 underline-offset-2 hover:text-accent";

function Maybe({ href, children }) {
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={linkCls}>
      {children}
    </a>
  ) : (
    <span>{children}</span>
  );
}

export default function Footer() {
  return (
    <footer className="footer mt-12 border-t border-rule pt-6 text-center font-mono text-[11px] text-ink-dim">
      <div className="uppercase tracking-[0.2em] text-accent-dim">
        POWERED BY ESA GAIA DR3 · NASA JPL · IAU · ESO
      </div>
      <ul
        id="credits"
        className="mx-auto mt-4 grid max-w-3xl gap-x-8 gap-y-1 text-left text-[10px] tracking-wide text-ink-dim/80 sm:grid-cols-2"
      >
        {CREDITS.map(({ what, who, href, license, licenseHref, note }) => (
          <li key={what}>
            <span className="text-ink-dim/60">{what}: </span>
            <Maybe href={href}>{who}</Maybe>
            {license && (
              <>
                {" · "}
                <Maybe href={licenseHref}>{license}</Maybe>
              </>
            )}
            {note && <span className="text-ink-dim/60"> ({note})</span>}
          </li>
        ))}
      </ul>
      <a
        href="/about"
        className="mt-4 inline-block text-[10px] uppercase tracking-[0.2em] text-accent-dim hover:text-accent"
      >
        About &amp; full acknowledgements
      </a>
    </footer>
  );
}
