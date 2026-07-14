import { describe, it, expect } from "vitest";
import { inverseStereographic } from "../utils/inverseStereographic.js";

const W = 1000;
const H = 600;
const REF_ALT = 0;

describe("inverseStereographic with refAlt=0 (1000x600 canvas)", () => {
  it("center pixel → zenith (alt=90°)", () => {
    const { altDeg } = inverseStereographic(500, 300, W, H, REF_ALT);
    expect(altDeg).toBeCloseTo(90, 4);
  });

  it("east horizon pixel (LEFT side, inside view) → alt=0°, az=90°", () => {
    const { altDeg, azDeg } = inverseStereographic(200, 300, W, H, REF_ALT);
    expect(altDeg).toBeCloseTo(0, 3);
    expect(azDeg).toBeCloseTo(90, 3);
  });

  it("north horizon pixel → alt=0°, az=0°", () => {
    const { altDeg, azDeg } = inverseStereographic(500, 0, W, H, REF_ALT);
    expect(altDeg).toBeCloseTo(0, 3);
    expect(((azDeg % 360) + 360) % 360).toBeCloseTo(0, 3);
  });

  it("west horizon pixel (RIGHT side, inside view) → alt=0°, az=270°", () => {
    const { altDeg, azDeg } = inverseStereographic(800, 300, W, H, REF_ALT);
    expect(altDeg).toBeCloseTo(0, 3);
    expect(azDeg).toBeCloseTo(270, 3);
  });

  it("south horizon pixel → alt=0°, az=180°", () => {
    const { altDeg, azDeg } = inverseStereographic(500, 600, W, H, REF_ALT);
    expect(altDeg).toBeCloseTo(0, 3);
    expect(azDeg).toBeCloseTo(180, 3);
  });

  it("beyond horizon (400px from center) → alt < 0", () => {
    const { altDeg } = inverseStereographic(900, 300, W, H, REF_ALT);
    expect(altDeg).toBeLessThan(0);
  });

  it("round-trip with projectAltAz keeps within 0.01° for above-horizon points", async () => {
    const { projectAltAz } = await import("../utils/projection.js");
    const samples = [
      { alt: 80, az: 0 },
      { alt: 60, az: 45 },
      { alt: 30, az: 137 },
      { alt: 5, az: 270 },
    ];
    for (const s of samples) {
      const { x, y } = projectAltAz(s, W, H);
      const back = inverseStereographic(x, y, W, H, REF_ALT);
      expect(back.altDeg).toBeCloseTo(s.alt, 2);
      expect(back.azDeg).toBeCloseTo(s.az, 2);
    }
  });
});
