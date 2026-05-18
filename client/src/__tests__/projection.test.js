import { describe, it, expect } from "vitest";
import {
  projectAltAz,
  projectStars,
  projectPlanets,
  projectDsos,
  REFERENCE_ALT,
} from "../utils/projection.js";

describe("projectAltAz", () => {
  it("projects zenith (alt=90) to the rectangle center", () => {
    const result = projectAltAz({ alt: 90, az: 0 }, 800, 450);
    expect(result.x).toBeCloseTo(400, 5);
    expect(result.y).toBeCloseTo(225, 5);
  });

  it("projects due north (alt=0, az=0) above zenith along +y-up axis", () => {
    const { x, y } = projectAltAz({ alt: 0, az: 0 }, 800, 450);
    // North is "up" on the chart — canvas y decreases going up.
    expect(x).toBeCloseTo(400, 5);
    expect(y).toBeLessThan(225);
  });

  it("projects due east (alt=0, az=90) to the right of zenith", () => {
    const { x, y } = projectAltAz({ alt: 0, az: 90 }, 800, 450);
    expect(x).toBeGreaterThan(400);
    expect(y).toBeCloseTo(225, 5);
  });

  it("projects due west (alt=0, az=270) to the left of zenith", () => {
    const { x } = projectAltAz({ alt: 0, az: 270 }, 800, 450);
    expect(x).toBeLessThan(400);
  });

  it("at REFERENCE_ALT, radial distance equals half the shorter side", () => {
    const width = 800;
    const height = 450;
    const halfShort = Math.min(width, height) / 2; // 225
    const { x, y } = projectAltAz({ alt: REFERENCE_ALT, az: 0 }, width, height);
    const dy = Math.abs(y - height / 2);
    expect(dy).toBeCloseTo(halfShort, 3);
    expect(x).toBeCloseTo(width / 2, 5);
  });

  it("non-square rectangles keep zenith centered", () => {
    const r1 = projectAltAz({ alt: 90, az: 0 }, 1200, 675);
    expect(r1.x).toBeCloseTo(600, 5);
    expect(r1.y).toBeCloseTo(337.5, 5);

    const r2 = projectAltAz({ alt: 90, az: 0 }, 327, 245);
    expect(r2.x).toBeCloseTo(163.5, 5);
    expect(r2.y).toBeCloseTo(122.5, 5);
  });

  it("returns finite x,y for very low altitude at wide azimuth", () => {
    const { x, y } = projectAltAz({ alt: 1, az: 135 }, 800, 450);
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
  });
});

describe("projectStars", () => {
  it("returns empty array for empty input", () => {
    expect(projectStars([], 800, 450)).toEqual([]);
  });

  it("attaches kind='star' and preserves source_id", () => {
    const stars = [
      {
        source_id: "4089383515393106688",
        alt: 45,
        az: 180,
        magnitude: 1.2,
        bp_rp: 0.4,
      },
    ];
    const projected = projectStars(stars, 800, 450);
    expect(projected).toHaveLength(1);
    expect(projected[0].kind).toBe("star");
    expect(projected[0].id).toBe("star:4089383515393106688");
    expect(projected[0].source_id).toBe("4089383515393106688");
    expect(typeof projected[0].x).toBe("number");
    expect(typeof projected[0].y).toBe("number");
  });
});

describe("projectPlanets", () => {
  it("attaches kind='planet' and namespaces id by name", () => {
    const planets = [
      { name: "Jupiter", alt: 40, az: 120, distance_au: 5.03 },
    ];
    const projected = projectPlanets(planets, 800, 450);
    expect(projected).toHaveLength(1);
    expect(projected[0].kind).toBe("planet");
    expect(projected[0].id).toBe("planet:Jupiter");
    expect(projected[0].name).toBe("Jupiter");
  });
});

describe("projectDsos", () => {
  it("projects an above-horizon DSO with kind=dso and pxPerArcmin", () => {
    const dsos = [{
      id: "M31", common_name: "Andromeda Galaxy",
      type: "galaxy",
      ra: 10.6847, dec: 41.2687,
      alt: 45, az: 90,
      magnitude: 3.44,
      angular_size_arcmin: 178,
      minor_axis_arcmin: 63,
      position_angle_deg: 35,
      source: "SIMBAD/CDS",
    }];
    const projected = projectDsos(dsos, 1000, 1000);
    expect(projected).toHaveLength(1);
    const p = projected[0];
    expect(p.kind).toBe("dso");
    expect(p.id).toBe("dso:M31");
    expect(typeof p.x).toBe("number");
    expect(typeof p.y).toBe("number");
    expect(p.pxPerArcmin).toBeGreaterThan(0);
    // hitRadius should be derived from angular size in pixels, min 12px
    expect(p.hitRadius).toBeGreaterThanOrEqual(12);
    // Original DSO fields preserved
    expect(p.type).toBe("galaxy");
    expect(p.common_name).toBe("Andromeda Galaxy");
  });

  it("returns [] for empty input or zero-size canvas", () => {
    expect(projectDsos([], 1000, 1000)).toEqual([]);
    expect(projectDsos([{ alt: 0, az: 0 }], 0, 0)).toEqual([]);
  });
});
