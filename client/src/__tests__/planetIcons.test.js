import { describe, it, expect } from "vitest";
import { PLANET_ICONS } from "../utils/planetIcons.js";

describe("PLANET_ICONS map", () => {
  it("has a renderer for each of the seven non-Sun/Moon planets", () => {
    expect(Object.keys(PLANET_ICONS).sort()).toEqual([
      "Jupiter",
      "Mars",
      "Mercury",
      "Neptune",
      "Saturn",
      "Uranus",
      "Venus",
    ]);
  });

  it("each entry is a function", () => {
    for (const name of Object.keys(PLANET_ICONS)) {
      expect(typeof PLANET_ICONS[name]).toBe("function");
    }
  });

  it("does not include Sun (procedural in drawing.js) or Moon (textured)", () => {
    expect(PLANET_ICONS.Sun).toBeUndefined();
    expect(PLANET_ICONS.Moon).toBeUndefined();
  });
});
