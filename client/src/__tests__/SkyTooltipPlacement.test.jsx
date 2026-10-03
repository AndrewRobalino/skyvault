import { describe, it, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import SkyTooltip from "../components/hero/SkyTooltip.jsx";

// jsdom has no layout; give the tooltip a real-ish rendered height.
const realOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
function fakeTooltipHeight(px) {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      return this.getAttribute("role") === "dialog" ? px : 0;
    },
  });
}
afterEach(() => {
  if (realOffsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", realOffsetHeight);
});

const star = (x, y) => ({
  kind: "star", id: "star:1", source_id: "1", x, y,
  magnitude: 3, bp_rp: 0.5, alt: 10, az: 180, source: "Gaia DR3",
});

describe("<SkyTooltip> placement", () => {
  it("never runs off the bottom of the chart", () => {
    // Phone-sized chart: 260 px tall. A star near the southern horizon.
    fakeTooltipHeight(200);
    render(<SkyTooltip object={star(150, 240)} container={{ width: 340, height: 260 }} />);
    const tip = screen.getByRole("dialog");
    expect(parseFloat(tip.style.top) + 200).toBeLessThanOrEqual(260);
  });

  it("never runs off the left edge when flipped on a narrow chart", () => {
    render(<SkyTooltip object={star(150, 100)} container={{ width: 300, height: 260 }} />);
    const tip = screen.getByRole("dialog");
    const left = parseFloat(tip.style.left);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left + parseFloat(tip.style.width)).toBeLessThanOrEqual(300);
  });

  it("is capped to the chart height and scrolls if taller", () => {
    render(<SkyTooltip object={star(150, 100)} container={{ width: 340, height: 260 }} />);
    const tip = screen.getByRole("dialog");
    expect(parseFloat(tip.style.maxHeight)).toBeLessThanOrEqual(260);
    expect(tip.style.overflowY).toBe("auto");
  });
});
