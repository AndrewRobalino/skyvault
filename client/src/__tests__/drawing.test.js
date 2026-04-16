import { describe, it, expect } from "vitest";
import { magnitudeToGlow } from "../utils/drawing.js";

describe("magnitudeToGlow", () => {
  it("brightest tier (mag <= 0) returns bold halo", () => {
    expect(magnitudeToGlow(-1.46)).toEqual({ core: 3.0, halo: 18 });
    expect(magnitudeToGlow(0)).toEqual({ core: 3.0, halo: 18 });
  });

  it("mag 0–2 tier returns medium halo", () => {
    expect(magnitudeToGlow(2)).toEqual({ core: 2.5, halo: 12 });
  });

  it("mag 2–4 tier returns smaller halo", () => {
    expect(magnitudeToGlow(4)).toEqual({ core: 2.0, halo: 6 });
  });

  it("mag 4–6 tier returns dim halo", () => {
    expect(magnitudeToGlow(6)).toEqual({ core: 1.5, halo: 3 });
  });

  it("mag > 6 clamps to pixel-dot tier (no halo)", () => {
    expect(magnitudeToGlow(6.5)).toEqual({ core: 1.0, halo: 0 });
    expect(magnitudeToGlow(10)).toEqual({ core: 1.0, halo: 0 });
  });

  it("interpolates linearly between breakpoints", () => {
    // Midway between mag 0 (core 3.0, halo 18) and mag 2 (core 2.5, halo 12)
    const { core, halo } = magnitudeToGlow(1);
    expect(core).toBeCloseTo(2.75, 5);
    expect(halo).toBeCloseTo(15, 5);
  });

  it("returns sane default for null/NaN magnitude", () => {
    expect(magnitudeToGlow(null)).toEqual({ core: 1.0, halo: 0 });
    expect(magnitudeToGlow(undefined)).toEqual({ core: 1.0, halo: 0 });
    expect(magnitudeToGlow(NaN)).toEqual({ core: 1.0, halo: 0 });
  });
});
