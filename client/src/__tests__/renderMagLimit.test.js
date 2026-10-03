import { describe, it, expect } from "vitest";
import { renderMagLimit, FULL_MAG_LIMIT, REFERENCE_DIAMETER_PX } from "../utils/renderMagLimit.js";

describe("renderMagLimit (keep star density constant across chart sizes)", () => {
  it("shows the full catalog on laptop-sized charts and larger", () => {
    expect(renderMagLimit(REFERENCE_DIAMETER_PX)).toBe(FULL_MAG_LIMIT);
    expect(renderMagLimit(900)).toBe(FULL_MAG_LIMIT);
  });

  it("halving the chart area drops the limit by log(2)/log(3.1) mag (half the stars)", () => {
    // Our catalog's counts grow x3.1 per magnitude (measured: x1.75 per 0.5 mag).
    const halfArea = REFERENCE_DIAMETER_PX / Math.SQRT2;
    expect(renderMagLimit(halfArea)).toBeCloseTo(FULL_MAG_LIMIT - Math.log(2) / Math.log(3.1), 6);
  });

  it("gives a phone-width chart (~350 px) roughly magnitude 5.9", () => {
    const lim = renderMagLimit(350);
    expect(lim).toBeGreaterThan(5.7);
    expect(lim).toBeLessThan(6.0);
  });

  it("never drops below a floor that keeps the bright constellations", () => {
    expect(renderMagLimit(60)).toBe(4.5);
  });

  it("falls back to the full limit before the chart has been measured", () => {
    expect(renderMagLimit(0)).toBe(FULL_MAG_LIMIT);
    expect(renderMagLimit(NaN)).toBe(FULL_MAG_LIMIT);
  });
});
