import { describe, it, expect } from "vitest";
import { markerScale, REFERENCE_DIAMETER_PX } from "../utils/markerScale.js";

describe("markerScale (draw markers as if the laptop chart were shrunk)", () => {
  it("is 1 on laptop-sized charts and larger", () => {
    expect(markerScale(REFERENCE_DIAMETER_PX)).toBe(1);
    expect(markerScale(1000)).toBe(1);
  });

  it("is proportional below the reference size (a ~290 px phone chart ~ 0.52)", () => {
    expect(markerScale(290)).toBeCloseTo(290 / REFERENCE_DIAMETER_PX, 6);
  });

  it("has a floor so markers never vanish", () => {
    expect(markerScale(50)).toBe(0.35);
  });

  it("is 1 before the chart has been measured", () => {
    expect(markerScale(0)).toBe(1);
    expect(markerScale(NaN)).toBe(1);
  });
});
