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
  it("brightest stars clamp/approach the top-tier halo (Sirius-class)", () => {
    // Anything at or below the top breakpoint (-1.5) clamps exactly.
    expect(magnitudeToGlow(-2)).toEqual({ core: 1.8, halo: 10 });
    expect(magnitudeToGlow(-1.5)).toEqual({ core: 1.8, halo: 10 });
    // Sirius (-1.46) sits just inside the first interval — nearly identical.
    const sirius = magnitudeToGlow(-1.46);
    expect(sirius.core).toBeCloseTo(1.79, 2);
    expect(sirius.halo).toBeCloseTo(9.89, 2);
  });

  it("mag 0 (Vega-class) returns notable halo", () => {
    expect(magnitudeToGlow(0)).toEqual({ core: 1.5, halo: 6 });
  });

  it("mag 1 (Polaris-class) returns small halo", () => {
    expect(magnitudeToGlow(1)).toEqual({ core: 1.2, halo: 3 });
  });

  it("mag 2 sits exactly at the halo cutoff (no glow from here on)", () => {
    expect(magnitudeToGlow(2)).toEqual({ core: 1.0, halo: 0 });
  });

  it("mid-mag stars (3, 4) are tiny dots with no halo", () => {
    expect(magnitudeToGlow(3)).toEqual({ core: 0.85, halo: 0 });
    expect(magnitudeToGlow(4)).toEqual({ core: 0.7, halo: 0 });
  });

  it("dimmest visible (mag 5, 6) are sub-pixel dots", () => {
    expect(magnitudeToGlow(5)).toEqual({ core: 0.6, halo: 0 });
    expect(magnitudeToGlow(6)).toEqual({ core: 0.5, halo: 0 });
  });

  it("mag > 6 clamps to dim tier", () => {
    expect(magnitudeToGlow(6.5)).toEqual({ core: 0.5, halo: 0 });
    expect(magnitudeToGlow(10)).toEqual({ core: 0.5, halo: 0 });
  });

  it("interpolates linearly between breakpoints", () => {
    // Midway between mag 0 (core 1.5, halo 6) and mag 1 (core 1.2, halo 3)
    const { core, halo } = magnitudeToGlow(0.5);
    expect(core).toBeCloseTo(1.35, 5);
    expect(halo).toBeCloseTo(4.5, 5);
  });

  it("returns sane default for null/NaN magnitude", () => {
    expect(magnitudeToGlow(null)).toEqual({ core: 0.5, halo: 0 });
    expect(magnitudeToGlow(undefined)).toEqual({ core: 0.5, halo: 0 });
    expect(magnitudeToGlow(NaN)).toEqual({ core: 0.5, halo: 0 });
  });
});

function makeMockCtx() {
  // Mirror the real CanvasGradient.addColorStop contract — throw IndexSizeError
  // when the offset is outside [0, 1], so tests catch the same bug a browser would.
  const makeGradient = () => ({
    addColorStop: vi.fn((offset, _color) => {
      if (offset < 0 || offset > 1 || !Number.isFinite(offset)) {
        throw new RangeError(
          `addColorStop: offset ${offset} is outside [0, 1]`
        );
      }
    }),
  });
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    createRadialGradient: vi.fn(makeGradient),
    fillRect: vi.fn(),
    set fillStyle(_) {},
    set strokeStyle(_) {},
    set lineWidth(_) {},
    set globalCompositeOperation(_) {},
  };
}

describe("drawStar", () => {
  it("draws an anti-aliased arc (not a rect) for dim stars with halo=0", () => {
    const ctx = makeMockCtx();
    drawStar(ctx, { x: 100, y: 100, magnitude: 7, bp_rp: null });
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.fillRect).not.toHaveBeenCalled();
    // No gradient halo for dim stars
    expect(ctx.createRadialGradient).not.toHaveBeenCalled();
  });

  it("draws a radial gradient halo for bright stars (mag <= 2)", () => {
    const ctx = makeMockCtx();
    drawStar(ctx, { x: 400, y: 200, magnitude: -1.46, bp_rp: 0.02 });
    expect(ctx.createRadialGradient).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it("does NOT throw when magnitude interpolates into a halo < core regime", () => {
    // Regression: at mag ~1.9 the linear interp between [1, core 1.2, halo 3]
    // and [2, core 1.0, halo 0] gives halo ≈ 0.3 and core ≈ 1.02 — passing
    // core/halo (~3.4) into gradient.addColorStop blows up with IndexSizeError
    // because stop positions must be in [0,1]. Fall through to the dim path.
    const ctx = makeMockCtx();
    expect(() =>
      drawStar(ctx, { x: 100, y: 100, magnitude: 1.9, bp_rp: 0.5, alt: 60 })
    ).not.toThrow();
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
  it("brightest stars (mag <= 1.5) → full color (1.0)", () => {
    expect(colorAmpFactor(-1.46)).toBe(1.0);
    expect(colorAmpFactor(0)).toBe(1.0);
    expect(colorAmpFactor(1.5)).toBe(1.0);
  });

  it("mag = 6 or higher → near-white (0.0)", () => {
    expect(colorAmpFactor(6)).toBe(0.0);
    expect(colorAmpFactor(7)).toBe(0.0);
    expect(colorAmpFactor(10)).toBe(0.0);
  });

  it("interpolates linearly between mag=1.5 and mag=6", () => {
    // Midpoint at mag = 3.75 → 0.5
    expect(colorAmpFactor(3.75)).toBeCloseTo(0.5, 4);
    // Mag 4 still retains ~44% color
    expect(colorAmpFactor(4)).toBeCloseTo(0.444, 2);
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
