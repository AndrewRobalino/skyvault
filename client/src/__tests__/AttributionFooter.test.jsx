import { describe, it, expect, beforeEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import AttributionFooter from "../components/hero/AttributionFooter.jsx";

describe("AttributionFooter", () => {
  beforeEach(() => cleanup());

  it("includes Milky Way panorama attribution (CC BY 4.0 — license-critical)", () => {
    render(<AttributionFooter />);
    expect(screen.getByText(/Brunier/i)).toBeTruthy();
    expect(screen.getAllByText(/CC BY 4\.0/i).length).toBeGreaterThan(0);
  });

  it("includes ESA Gaia DR3 attribution", () => {
    render(<AttributionFooter />);
    expect(screen.getByText(/Gaia DR3/i)).toBeTruthy();
  });

  it("includes NASA JPL attribution", () => {
    render(<AttributionFooter />);
    expect(screen.getByText(/JPL/i)).toBeTruthy();
  });

  it("credits Solar System Scope for planet/moon textures", () => {
    render(<AttributionFooter />);
    expect(screen.getByText(/Solar System Scope/)).toBeInTheDocument();
  });

  it("credits SIMBAD/CDS for DSO data", () => {
    render(<AttributionFooter />);
    expect(screen.getByText(/SIMBAD\/CDS/)).toBeInTheDocument();
  });

  it("renders inside an absolute-positioned container", () => {
    const { container } = render(<AttributionFooter />);
    const root = container.firstChild;
    expect(root.className).toMatch(/absolute/);
  });
});
