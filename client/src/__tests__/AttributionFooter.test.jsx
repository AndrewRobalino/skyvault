import { describe, it, expect, beforeEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import AttributionFooter from "../components/hero/AttributionFooter.jsx";

describe("AttributionFooter", () => {
  beforeEach(() => cleanup());

  it("includes Milky Way panorama attribution (CC BY 4.0 — license-critical)", () => {
    render(<AttributionFooter />);
    expect(screen.getByText(/Brunier/i)).toBeTruthy();
    expect(screen.getByText(/CC BY 4\.0/i)).toBeTruthy();
  });

  it("includes ESA Gaia DR3 attribution", () => {
    render(<AttributionFooter />);
    expect(screen.getByText(/Gaia DR3/i)).toBeTruthy();
  });

  it("includes NASA JPL attribution", () => {
    render(<AttributionFooter />);
    expect(screen.getByText(/JPL/i)).toBeTruthy();
  });

  it("renders inside an absolute-positioned container", () => {
    const { container } = render(<AttributionFooter />);
    const root = container.firstChild;
    expect(root.className).toMatch(/absolute/);
  });
});
