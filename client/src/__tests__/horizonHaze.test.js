import { describe, it, expect } from "vitest";
import { horizonHaze } from "../utils/horizonHaze.js";

describe("horizonHaze", () => {
  it("alt >= 30° returns no effect", () => {
    expect(horizonHaze(30)).toEqual({ brightnessMul: 1.0, redShift: 0 });
    expect(horizonHaze(45)).toEqual({ brightnessMul: 1.0, redShift: 0 });
    expect(horizonHaze(90)).toEqual({ brightnessMul: 1.0, redShift: 0 });
  });

  it("alt = 10° returns mid haze ({0.7, 0.3})", () => {
    const { brightnessMul, redShift } = horizonHaze(10);
    expect(brightnessMul).toBeCloseTo(0.7, 4);
    expect(redShift).toBeCloseTo(0.3, 4);
  });

  it("alt = 0° returns max haze ({0.3, 0.6})", () => {
    const { brightnessMul, redShift } = horizonHaze(0);
    expect(brightnessMul).toBeCloseTo(0.3, 4);
    expect(redShift).toBeCloseTo(0.6, 4);
  });

  it("alt < 0° clamps to alt = 0° values", () => {
    expect(horizonHaze(-5)).toEqual(horizonHaze(0));
    expect(horizonHaze(-90)).toEqual(horizonHaze(0));
  });

  it("interpolates linearly between 0 and 10", () => {
    const { brightnessMul, redShift } = horizonHaze(5);
    expect(brightnessMul).toBeCloseTo(0.5, 4);
    expect(redShift).toBeCloseTo(0.45, 4);
  });

  it("interpolates linearly between 10 and 30", () => {
    const { brightnessMul, redShift } = horizonHaze(20);
    expect(brightnessMul).toBeCloseTo(0.85, 4);
    expect(redShift).toBeCloseTo(0.15, 4);
  });
});
