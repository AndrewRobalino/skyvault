import { describe, it, expect, vi } from "vitest";
import {
  magnitudeToGlow,
  drawStar,
  drawPlanet,
  colorAmpFactor,
  PLANET_SIZES,
  PLANET_TINTS,
} from "../utils/drawing.js";

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

function makeMockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    fillRect: vi.fn(),
    set fillStyle(_) {},
    set strokeStyle(_) {},
    set lineWidth(_) {},
    set globalCompositeOperation(_) {},
  };
}

describe("drawStar", () => {
  it("draws a filled rect (1px) for dim stars with halo=0", () => {
    const ctx = makeMockCtx();
    drawStar(ctx, { x: 100, y: 100, magnitude: 7, bp_rp: null });
    expect(ctx.fillRect).toHaveBeenCalled();
    // No gradient for dim stars
    expect(ctx.createRadialGradient).not.toHaveBeenCalled();
  });

  it("draws a radial gradient halo for bright stars", () => {
    const ctx = makeMockCtx();
    drawStar(ctx, { x: 400, y: 200, magnitude: -1.46, bp_rp: 0.02 });
    expect(ctx.createRadialGradient).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });
});

describe("drawPlanet", () => {
  it("draws planet marker with ring for non-Moon bodies", () => {
    const ctx = makeMockCtx();
    drawPlanet(ctx, { x: 400, y: 200, name: "Jupiter" });
    expect(ctx.createRadialGradient).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("Moon uses custom path with illumination shadow", () => {
    const ctx = makeMockCtx();
    drawPlanet(ctx, {
      x: 400,
      y: 200,
      name: "Moon",
      illumination: 0.5,
      phase_name: "first quarter",
    });
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });
});

describe("colorAmpFactor", () => {
  it("brightest stars (mag <= 1) → full color (1.0)", () => {
    expect(colorAmpFactor(-1.46)).toBe(1.0);
    expect(colorAmpFactor(0)).toBe(1.0);
    expect(colorAmpFactor(1)).toBe(1.0);
  });

  it("mag = 4 or higher → near-white (0.0)", () => {
    expect(colorAmpFactor(4)).toBe(0.0);
    expect(colorAmpFactor(6)).toBe(0.0);
    expect(colorAmpFactor(10)).toBe(0.0);
  });

  it("interpolates linearly between mag=1 and mag=4", () => {
    expect(colorAmpFactor(2.5)).toBeCloseTo(0.5, 4);
    expect(colorAmpFactor(2)).toBeCloseTo(0.667, 2);
  });
});

describe("drawStar with horizon haze and color amp", () => {
  function mockCtx() {
    const calls = [];
    const gradientStops = [];
    return {
      calls,
      gradientStops,
      save: () => calls.push(["save"]),
      restore: () => calls.push(["restore"]),
      fillRect: (...args) => calls.push(["fillRect", ...args]),
      arc: (...args) => calls.push(["arc", ...args]),
      beginPath: () => calls.push(["beginPath"]),
      fill: () => calls.push(["fill"]),
      createRadialGradient: () => ({
        addColorStop: (offset, color) => gradientStops.push({ offset, color }),
      }),
      set fillStyle(v) { calls.push(["fillStyle", v]); },
      set globalCompositeOperation(v) { calls.push(["gco", v]); },
    };
  }

  it("bright star at zenith uses near-full alpha (no haze)", () => {
    const ctx = mockCtx();
    drawStar(ctx, { x: 100, y: 100, magnitude: 0, bp_rp: 0, alt: 90 });
    expect(ctx.gradientStops[0].color).toMatch(/rgba\(255, 255, 255, 1\)/);
  });

  it("bright star near horizon dims (alt=0 → brightnessMul=0.3)", () => {
    const ctx = mockCtx();
    drawStar(ctx, { x: 100, y: 100, magnitude: 0, bp_rp: 0, alt: 0 });
    expect(ctx.gradientStops[0].color).toMatch(/rgba\(255, 255, 255, 0\.3\)/);
  });

  it("dim star (mag=7) blends toward white regardless of bp_rp", () => {
    const ctx = mockCtx();
    drawStar(ctx, { x: 100, y: 100, magnitude: 7, bp_rp: 2.0, alt: 90 });
    const fillStyleCall = ctx.calls.find((c) => c[0] === "fillStyle");
    expect(fillStyleCall[1]).toMatch(/^rgba\(255, 255, 255/);
  });

  it("missing alt defaults to 90 (zenith, no haze)", () => {
    const ctx = mockCtx();
    drawStar(ctx, { x: 100, y: 100, magnitude: 0, bp_rp: 0 });
    expect(ctx.gradientStops[0].color).toMatch(/rgba\(255, 255, 255, 1\)/);
  });
});

describe("planet sizes (Phase 2c bumps)", () => {
  it("Venus is 16px diameter", () => {
    expect(PLANET_SIZES.Venus).toBe(16);
  });
  it("Jupiter is 16px diameter", () => {
    expect(PLANET_SIZES.Jupiter).toBe(16);
  });
  it("Mars is 14px diameter", () => {
    expect(PLANET_SIZES.Mars).toBe(14);
  });
  it("Mercury, Saturn, Uranus, Neptune are 13px diameter", () => {
    expect(PLANET_SIZES.Mercury).toBe(13);
    expect(PLANET_SIZES.Saturn).toBe(13);
    expect(PLANET_SIZES.Uranus).toBe(13);
    expect(PLANET_SIZES.Neptune).toBe(13);
  });
  it("Sun and Moon stay at 16px", () => {
    expect(PLANET_SIZES.Sun).toBe(16);
    expect(PLANET_SIZES.Moon).toBe(16);
  });
});

describe("planet tints (Phase 2c per-planet colors)", () => {
  it("Mars is reddish", () => {
    expect(PLANET_TINTS.Mars).toBe("#d97a4a");
  });
  it("Venus is bright cream-white", () => {
    expect(PLANET_TINTS.Venus).toBe("#f5e8c0");
  });
  it("Jupiter is pale cream-amber", () => {
    expect(PLANET_TINTS.Jupiter).toBe("#e8c98a");
  });
  it("Saturn is yellow-tan", () => {
    expect(PLANET_TINTS.Saturn).toBe("#c9a86a");
  });
  it("Mercury is neutral grey-tan", () => {
    expect(PLANET_TINTS.Mercury).toBe("#b8a890");
  });
  it("Uranus is cool cyan-blue", () => {
    expect(PLANET_TINTS.Uranus).toBe("#8eb5c4");
  });
  it("Neptune is darker cool blue", () => {
    expect(PLANET_TINTS.Neptune).toBe("#6a8cb4");
  });
});
