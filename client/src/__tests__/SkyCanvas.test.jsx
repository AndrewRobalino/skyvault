import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import SkyCanvas from "../components/hero/SkyCanvas.jsx";

const calls = [];
const gradientStub = { addColorStop: vi.fn() };
const ctxStub = {
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  beginPath: () => calls.push("beginPath"),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: () => calls.push("stroke"),
  arc: () => calls.push("arc"),
  fill: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  createRadialGradient: vi.fn(() => gradientStub),
  set strokeStyle(_v) {},
  set lineWidth(_v) {},
  set globalAlpha(_v) {},
  set fillStyle(_v) {},
  set globalCompositeOperation(_v) {},
};

beforeEach(() => {
  calls.length = 0;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctxStub);
});

describe("SkyCanvas constellation lines", () => {
  it("strokes constellation lines before drawing stars", () => {
    render(
      <SkyCanvas
        projectedStars={[{ x: 100, y: 100, magnitude: 1 }]}
        projectedPlanets={[]}
        projectedDsos={[]}
        projectedLines={[{ x1: 10, y1: 10, x2: 20, y2: 20 }]}
        width={800}
        height={600}
        dpr={1}
      />
    );
    const firstStroke = calls.indexOf("stroke");
    const firstArc = calls.indexOf("arc");
    expect(firstStroke).toBeGreaterThanOrEqual(0);
    expect(firstArc).toBeGreaterThan(firstStroke);
  });
});
