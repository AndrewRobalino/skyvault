/**
 * Module-level image cache for planet/moon sprites.
 *
 * Returns a singleton HTMLImageElement per URL so renderers that ask for
 * the same texture every frame don't repeatedly construct Images (which would
 * defeat the browser's HTTP cache and flash blank frames during decode).
 *
 * Renderers should check `img.complete` before drawing — if false, fall back
 * to a colored dot for that frame.
 */

const cache = new Map();

export function getTexture(url) {
  let img = cache.get(url);
  if (img) return img;
  img = new Image();
  img.src = url;
  cache.set(url, img);
  return img;
}

export function preloadTextures(urls) {
  return Promise.all(
    urls.map(
      (url) =>
        new Promise((resolve) => {
          const img = getTexture(url);
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => {
            img.removeEventListener("load", done);
            img.removeEventListener("error", done);
            resolve();
          };
          img.addEventListener("load", done);
          img.addEventListener("error", done);
        }),
    ),
  ).then(() => undefined);
}

// Test-only escape hatch — never call from app code.
export function _resetCacheForTests() {
  cache.clear();
}
