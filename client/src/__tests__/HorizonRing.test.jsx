import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import HorizonRing from "../components/hero/HorizonRing.jsx";

describe("HorizonRing", () => {
  beforeEach(() => cleanup());

  it("renders a canvas element", () => {
    const { container } = render(<HorizonRing width={1000} height={600} dpr={1} />);
    expect(container.querySelector("canvas")).toBeTruthy();
  });

  it("calls ctx.arc with horizon radius (halfShort) once", () => {
    const arcSpy = vi.fn();
    const beginPathSpy = vi.fn();
    const strokeSpy = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      arc: arcSpy,
      beginPath: beginPathSpy,
      stroke: strokeSpy,
      clearRect: vi.fn(),
      setTransform: vi.fn(),
      get strokeStyle() { return ""; },
      set strokeStyle(_v) {},
      get lineWidth() { return 1; },
      set lineWidth(_v) {},
    }));

    render(<HorizonRing width={1000} height={600} dpr={1} />);
    expect(arcSpy).toHaveBeenCalledWith(500, 300, 300, 0, expect.anything());
    expect(strokeSpy).toHaveBeenCalled();
  });

  it("does not render anything when width or height is 0", () => {
    const arcSpy = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      arc: arcSpy,
      beginPath: vi.fn(),
      stroke: vi.fn(),
      clearRect: vi.fn(),
      setTransform: vi.fn(),
      get strokeStyle() { return ""; }, set strokeStyle(_v) {},
      get lineWidth() { return 1; }, set lineWidth(_v) {},
    }));

    render(<HorizonRing width={0} height={0} dpr={1} />);
    expect(arcSpy).not.toHaveBeenCalled();
  });
});
