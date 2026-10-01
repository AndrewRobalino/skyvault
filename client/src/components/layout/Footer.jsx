/**
 * Page footer: the full data-credits list (#credits). The sky chart carries
 * the short on-image Milky Way credit plus a link here.
 *
 * Every row that a license requires attribution for names that license.
 * Keep this list in sync with the README data-sources table.
 */
const CC_BY_4 = "https://creativecommons.org/licenses/by/4.0/";

const CREDITS = [
  {
    what: "Milky Way panorama",
    who: "ESO/S. Brunier",
    href: "https://www.eso.org/public/images/eso0932a/",
    license: "CC BY 4.0",
    licenseHref: CC_BY_4,
  },
  {
    what: "Stars",
    who: "ESA Gaia DR3 (Gaia/DPAC)",
    href: "https://www.cosmos.esa.int/gaia",
    license: "CC BY-SA 3.0 IGO",
    licenseHref: "https://creativecommons.org/licenses/by-sa/3.0/igo/",
  },
  { what: "Brightest stars", who: "ESA Hipparcos" },
  { what: "Sun, Moon & planets", who: "NASA JPL DE421 via Astropy" },
  {
    what: "Planet & Moon textures",
    who: "Solar System Scope",
    href: "https://www.solarsystemscope.com/textures/",
    license: "CC BY 4.0",
    licenseHref: CC_BY_4,
  },
  { what: "Star names", who: "IAU WGSN", license: "CC BY" },
  {
    what: "Star & deep-sky data",
    who: "SIMBAD, CDS Strasbourg",
    href: "https://simbad.cds.unistra.fr/",
  },
  {
    what: "Exoplanets",
    who: "NASA Exoplanet Archive",
    href: "https://exoplanetarchive.ipac.caltech.edu/",
  },
  {
    what: "Constellation figures",
    who: "Stellarium",
    href: "https://stellarium.org/",
    license: "CC BY-SA",
  },
  {
    what: "Place search & time zones",
    who: "© OpenStreetMap contributors",
    href: "https://www.openstreetmap.org/copyright",
    license: "ODbL",
    licenseHref: "https://opendatacommons.org/licenses/odbl/",
  },
];

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
        {CREDITS.map(({ what, who, href, license, licenseHref }) => (
          <li key={what}>
            <span className="text-ink-dim/60">{what}: </span>
            <Maybe href={href}>{who}</Maybe>
            {license && (
              <>
                {" · "}
                <Maybe href={licenseHref}>{license}</Maybe>
              </>
            )}
          </li>
        ))}
      </ul>
    </footer>
  );
}
