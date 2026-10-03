import { describe, it, expect } from "vitest";
import { markerScale, REFERENCE_DIAMETER_PX } from "../utils/markerScale.js";

describe("markerScale", () => {
  it("is 1 on laptop-sized charts and larger (laptop look unchanged)", () => {
    expect(markerScale(REFERENCE_DIAMETER_PX)).toBe(1);
    expect(markerScale(1000)).toBe(1);
  });

  it("makes a phone chart match the downloaded snapshot viewed on the phone", () => {
    // The snapshot draws laptop-sized markers into a 1000 px sky and is then
    // shrunk to the screen, i.e. markers ~ 340/1000 of laptop size on a
    // ~340 px phone chart. Quadratic scaling lands there.
    expect(markerScale(340)).toBeCloseTo(340 / 1000, 1);
  });

  it("scales with the square of the size ratio between phone and laptop", () => {
    expect(markerScale(450)).toBeCloseTo((450 / REFERENCE_DIAMETER_PX) ** 2, 6);
  });

  it("has a floor so markers never vanish", () => {
    expect(markerScale(50)).toBe(0.25);
  });

  it("is 1 before the chart has been measured", () => {
    expect(markerScale(0)).toBe(1);
    expect(markerScale(NaN)).toBe(1);
  });
});
