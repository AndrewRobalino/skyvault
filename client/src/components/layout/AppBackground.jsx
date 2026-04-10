/**
 * Fixed-position full-viewport Milky Way background.
 * All CSS (::before for image, ::after for vignette) lives in global.css.
 * This component just renders the div that carries the .app-background class.
 */
export default function AppBackground() {
  return <div className="app-background" aria-hidden="true" />;
}
