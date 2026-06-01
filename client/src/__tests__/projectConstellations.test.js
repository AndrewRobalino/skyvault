import { describe, it, expect } from "vitest";
import { projectConstellations } from "../utils/projection.js";

const W = 800;
const H = 600;

const sample = [
  {
    id: "Ori",
    name: "Orion",
    segments: [
      { from_alt: 45, from_az: 90, to_alt: 50, to_az: 95, visible: true },
      { from_alt: 10, from_az: 180, to_alt: -5, to_az: 185, visible: false },
    ],
    label_alt: 47,
    label_az: 92,
    label_visible: true,
  },
];

describe("projectConstellations", () => {
  it("returns only visible segments with screen coords", () => {
    const { lines } = projectConstellations(sample, W, H);
    expect(lines).toHaveLength(1);
    const seg = lines[0];
    expect(seg).toHaveProperty("x1");
    expect(seg).toHaveProperty("y2");
    expect(Number.isFinite(seg.x1)).toBe(true);
  });

  it("returns only visible labels with screen coords + name", () => {
    const { labels } = projectConstellations(sample, W, H);
    expect(labels).toHaveLength(1);
    expect(labels[0].name).toBe("Orion");
    expect(Number.isFinite(labels[0].x)).toBe(true);
  });

  it("handles empty input", () => {
    expect(projectConstellations([], W, H)).toEqual({ lines: [], labels: [] });
    expect(projectConstellations(undefined, W, H)).toEqual({ lines: [], labels: [] });
  });
});
