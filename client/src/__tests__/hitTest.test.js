import { describe, it, expect } from "vitest";
import { findNearestWithinRadius, STAR_RADIUS, PLANET_RADIUS } from "../utils/hitTest.js";

describe("findNearestWithinRadius", () => {
  it("returns null for empty projected array", () => {
    expect(findNearestWithinRadius([], 100, 100)).toBeNull();
  });

  it("returns null when no object is within radius", () => {
    const projected = [{ kind: "star", id: "star:1", x: 0, y: 0 }];
    expect(findNearestWithinRadius(projected, 500, 500)).toBeNull();
  });

  it("returns the star when cursor is inside its radius", () => {
    const projected = [{ kind: "star", id: "star:42", x: 100, y: 100 }];
    const hit = findNearestWithinRadius(projected, 105, 100);
    expect(hit).not.toBeNull();
    expect(hit.id).toBe("star:42");
  });

  it("returns the nearer of two stars within radius", () => {
    const projected = [
      { kind: "star", id: "star:far", x: 100, y: 100 },
      { kind: "star", id: "star:near", x: 104, y: 100 },
    ];
    const hit = findNearestWithinRadius(projected, 105, 100);
    expect(hit.id).toBe("star:near");
  });

  it("planets have a larger effective radius than stars", () => {
    // At distance ~18px, a star (14px radius) would NOT match,
    // but a planet (22px radius) WILL match.
    const star = { kind: "star", id: "star:1", x: 100, y: 100 };
    const planet = { kind: "planet", id: "planet:Mars", x: 100, y: 100 };

    const starOnly = findNearestWithinRadius([star], 118, 100);
    expect(starOnly).toBeNull();

    const planetOnly = findNearestWithinRadius([planet], 118, 100);
    expect(planetOnly).not.toBeNull();
    expect(planetOnly.id).toBe("planet:Mars");
  });

  it("planet wins when cursor is inside planet radius, regardless of close star", () => {
    // At d=20, cursor is outside star radius (14) but inside planet radius (22).
    const projected = [
      { kind: "star", id: "star:close", x: 100, y: 100 },
      { kind: "planet", id: "planet:Mars", x: 100, y: 120 },
    ];
    const hit = findNearestWithinRadius(projected, 100, 120);
    expect(hit.id).toBe("planet:Mars");
  });

  it("exports radius constants", () => {
    expect(STAR_RADIUS).toBe(14);
    expect(PLANET_RADIUS).toBe(22);
  });
});
