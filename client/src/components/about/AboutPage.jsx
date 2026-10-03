import { ACKNOWLEDGEMENTS, APPROXIMATIONS, CREDITS } from "../layout/credits.js";

const link = "underline decoration-ink-dim/40 underline-offset-2 hover:text-accent";

/** /about: full credits, licenses, acknowledgements and method notes. */
export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-10 font-serif text-ink">
      <header className="space-y-3 border-b border-rule pb-6">
        <a href="/" className={`font-mono text-[11px] uppercase tracking-[0.25em] text-accent ${link}`}>
          ← Back to the sky
        </a>
        <h1 className="text-[clamp(28px,5vw,48px)] italic leading-tight">About SkyVault</h1>
        <p className="text-lg text-ink-dim">
          The real sky for any place and moment between 1900 and 2053: star positions from ESA
          Gaia DR3 and Hipparcos, the Sun, Moon and planets from NASA JPL DE421, all transformed to
          your horizon with Astropy. Built by Andrew Robalino Garcia.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-accent">Data &amp; licenses</h2>
        <ul className="space-y-2 text-base">
          {CREDITS.map(({ what, who, href, license, licenseHref, note }) => (
            <li key={what}>
              <span className="text-ink-dim">{what}: </span>
              {href ? (
                <a href={href} className={link}>
                  {who}
                </a>
              ) : (
                who
              )}
              {license && (
                <>
                  {" · "}
                  {licenseHref ? (
                    <a href={licenseHref} className={link}>
                      {license}
                    </a>
                  ) : (
                    license
                  )}
                </>
              )}
              {note && <span className="text-ink-dim"> ({note})</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-accent">Acknowledgements</h2>
        {ACKNOWLEDGEMENTS.map(({ source, text }) => (
          <p key={source} className="text-base text-ink-dim">
            {text}
          </p>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-accent">Known approximations</h2>
        <ul className="list-disc space-y-1 pl-5 text-base text-ink-dim">
          {APPROXIMATIONS.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}
