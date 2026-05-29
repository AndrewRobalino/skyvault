import { describe, it, expect, beforeEach } from "vitest";
import { getTexture, preloadTextures, _resetCacheForTests } from "../utils/textureCache.js";

describe("textureCache", () => {
  beforeEach(() => {
    _resetCacheForTests();
  });

  it("returns the same Image instance on repeated getTexture calls", () => {
    const a = getTexture("/textures/planets/mars.jpg");
    const b = getTexture("/textures/planets/mars.jpg");
    expect(a).toBe(b);
  });

  it("getTexture returns an Image whose src is set", () => {
    const img = getTexture("/textures/planets/jupiter.jpg");
    expect(img.src).toContain("/textures/planets/jupiter.jpg");
  });

  it("preloadTextures returns a promise that resolves when all images load or error", async () => {
    const urls = ["/textures/planets/mercury.jpg", "/textures/planets/mars.jpg"];
    const promise = preloadTextures(urls);
    // Simulate load on the cached images
    for (const u of urls) {
      const img = getTexture(u);
      img.dispatchEvent(new Event("load"));
    }
    await expect(promise).resolves.toBeUndefined();
  });

  it("preloadTextures resolves even if some images error", async () => {
    const urls = ["/textures/planets/mercury.jpg"];
    const promise = preloadTextures(urls);
    const img = getTexture(urls[0]);
    img.dispatchEvent(new Event("error"));
    await expect(promise).resolves.toBeUndefined();
  });
});
