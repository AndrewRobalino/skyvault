import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import SkyCanvas from "../components/hero/SkyCanvas.jsx";

const calls = [];
const gradientStub = { addColorStop: vi.fn() };
const arcRadii = [];
const ctxStub = {
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  beginPath: () => calls.push("beginPath"),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: () => calls.push("stroke"),
  arc: (_x, _y, r) => {
    calls.push("arc");
    arcRadii.push(r);
  },
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
  arcRadii.length = 0;
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

describe("SkyCanvas marker scale", () => {
  function starRadiusAt(size) {
    arcRadii.length = 0;
    render(
      <SkyCanvas
        projectedStars={[{ x: size / 2, y: size / 2, magnitude: 4, alt: 60 }]}
        projectedPlanets={[]}
        projectedDsos={[]}
        projectedLines={[]}
        width={size}
        height={size}
        dpr={1}
      />
    );
    return arcRadii[0];
  }

  it("draws the same star smaller on a phone-sized chart than on a laptop-sized one", () => {
    const laptop = starRadiusAt(800);
    const phone = starRadiusAt(290);
    expect(phone).toBeLessThan(laptop);
    expect(phone / laptop).toBeCloseTo(290 / 560, 2);
  });
});
