import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import AttributionFooter from "../components/hero/AttributionFooter.jsx";

// The on-chart credit is deliberately short (7 lines covered a phone-sized
// chart). The full list lives in the page footer (#credits), see Footer.test.
describe("AttributionFooter (on-chart)", () => {
  beforeEach(() => cleanup());

  it("keeps the Milky Way credit on the image itself (CC BY 4.0, license-critical)", () => {
    render(<AttributionFooter />);
    expect(screen.getByText(/Milky Way: ESO\/S\. Brunier · CC BY 4\.0/)).toBeInTheDocument();
  });

  it("links to the full data credits", () => {
    render(<AttributionFooter />);
    expect(screen.getByRole("link", { name: /data credits/i })).toHaveAttribute("href", "#credits");
  });

  it("clicking the credits link does not reach the chart's hit-test", () => {
    const onChartClick = vi.fn();
    render(
      <div onClick={onChartClick}>
        <AttributionFooter />
      </div>
    );
    fireEvent.click(screen.getByRole("link", { name: /data credits/i }));
    expect(onChartClick).not.toHaveBeenCalled();
  });

  it("renders inside an absolute-positioned container", () => {
    const { container } = render(<AttributionFooter />);
    expect(container.firstChild.className).toMatch(/absolute/);
  });
});
