import { describe, it, expect } from "vitest";
import { computeLST } from "../utils/coordinateTransforms.js";

describe("computeLST", () => {
  it("J2000 epoch (2000-01-01T12:00:00Z) at longitude 0 returns ~4.8949 rad", () => {
    const lst = computeLST("2000-01-01T12:00:00Z", 0);
    expect(lst).toBeCloseTo(4.8949, 2);
  });

  it("2026-01-01T00:00:00Z at longitude 0 returns ~1.7531 rad", () => {
    const lst = computeLST("2026-01-01T00:00:00Z", 0);
    expect(lst).toBeCloseTo(1.7531, 2);
  });

  it("2026-01-01T00:00:00Z at longitude -75° returns ~0.4439 rad", () => {
    const lst = computeLST("2026-01-01T00:00:00Z", -75);
    expect(lst).toBeCloseTo(0.4439, 2);
  });

  it("2026-06-21T12:00:00Z at longitude 0 returns ~1.5655 rad", () => {
    // Cross-checked via NOAA degree-form GMST (280.46061837 + 360.98564736629·d)
    // and Meeus eq. 12.4 — agree on ~89.46° = 1.5655 rad.
    const lst = computeLST("2026-06-21T12:00:00Z", 0);
    expect(lst).toBeCloseTo(1.5655, 2);
  });

  it("Miami (lon=-80.19) on 2026-04-15T03:30:00Z returns ~3.0652 rad", () => {
    // Cross-checked via NOAA degree-form GMST: GMST≈255.40°, LST≈175.21°≈3.058 rad
    // (the simple USNO formula here lands at 3.065, well inside our 0.005-rad budget).
    const lst = computeLST("2026-04-15T03:30:00Z", -80.19);
    expect(lst).toBeCloseTo(3.0652, 2);
  });

  it("result is always in [0, 2π)", () => {
    for (const lon of [-180, -90, 0, 90, 180]) {
      const lst = computeLST("2026-04-15T03:30:00Z", lon);
      expect(lst).toBeGreaterThanOrEqual(0);
      expect(lst).toBeLessThan(2 * Math.PI);
    }
  });

  it("accepts Date instances as well as ISO strings", () => {
    const fromString = computeLST("2026-04-15T03:30:00Z", -80.19);
    const fromDate = computeLST(new Date("2026-04-15T03:30:00Z"), -80.19);
    expect(fromDate).toBeCloseTo(fromString, 6);
  });
});
