import { describe, it, expect, vi } from "vitest";
import { drawDso, DSO_TYPE_COLORS } from "../utils/dsoDrawing.js";

function makeCtx() {
  const ops = [];
  return {
    ops,
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    ellipse: vi.fn((...a) => ops.push(["ellipse", ...a])),
    arc: vi.fn(),
    fill: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    set fillStyle(_v) {},
    set globalCompositeOperation(v) { ops.push(["composite", v]); },
  };
}

describe("drawDso", () => {
  it("draws an ellipse using additive blend", () => {
    const ctx = makeCtx();
    drawDso(ctx, {
      x: 200, y: 200, type: "galaxy",
      angular_size_arcmin: 178, minor_axis_arcmin: 63,
      position_angle_deg: 35, pxPerArcmin: 0.5,
    });
    expect(ctx.ellipse).toHaveBeenCalled();
    expect(ctx.ops.some((o) => o[0] === "composite" && o[1] === "lighter")).toBe(true);
  });

  it("rotates by position_angle_deg when provided", () => {
    const ctx = makeCtx();
    drawDso(ctx, {
      x: 100, y: 100, type: "galaxy",
      angular_size_arcmin: 100, minor_axis_arcmin: 50,
      position_angle_deg: 45, pxPerArcmin: 1,
    });
    expect(ctx.rotate).toHaveBeenCalledWith((45 * Math.PI) / 180);
  });

  it("defaults to a circle when minor axis is null", () => {
    const ctx = makeCtx();
    drawDso(ctx, {
      x: 100, y: 100, type: "open_cluster",
      angular_size_arcmin: 110, minor_axis_arcmin: null,
      position_angle_deg: null, pxPerArcmin: 0.5,
    });
    expect(ctx.ellipse).toHaveBeenCalled();
    const ellipseCall = ctx.ellipse.mock.calls[0];
    // ellipse(x, y, radiusX, radiusY, ...). For a "circle", x and y radii match.
    expect(ellipseCall[2]).toBeCloseTo(ellipseCall[3]);
  });

  it("uses the type-specific color", () => {
    expect(DSO_TYPE_COLORS.galaxy).toBeTruthy();
    expect(DSO_TYPE_COLORS.nebula).toBeTruthy();
    expect(DSO_TYPE_COLORS.open_cluster).toBeTruthy();
    expect(DSO_TYPE_COLORS.globular_cluster).toBeTruthy();
  });
});
