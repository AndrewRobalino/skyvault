import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SkyTooltip from "../components/hero/SkyTooltip.jsx";

const container = { width: 1200, height: 675 };

describe("<SkyTooltip>", () => {
  it("renders nothing when object is null", () => {
    const { container: c } = render(
      <SkyTooltip object={null} container={container} />
    );
    expect(c.firstChild).toBeNull();
  });

  it("renders star tooltip with Gaia source_id and source badge", () => {
    const star = {
      kind: "star",
      id: "star:4089383515393106688",
      source_id: "4089383515393106688",
      x: 400,
      y: 300,
      magnitude: -1.46,
      bp_rp: 0.02,
      distance_ly: 8.6,
      alt: 42.1,
      az: 183.4,
      source: "Gaia DR3",
    };
    render(<SkyTooltip object={star} container={container} />);
    expect(screen.getByText(/Star/i)).toBeInTheDocument();
    expect(screen.getByText(/4089383515393106688/)).toBeInTheDocument();
    expect(screen.getByText(/-1\.46/)).toBeInTheDocument();
    expect(screen.getByText(/0\.02/)).toBeInTheDocument();
    expect(screen.getByText(/8\.6 ly/)).toBeInTheDocument();
    expect(screen.getByText(/42\.1°/)).toBeInTheDocument();
    expect(screen.getByText(/183\.4°/)).toBeInTheDocument();
    expect(screen.getByText(/Source: Gaia DR3/)).toBeInTheDocument();
  });

  it("shows em-dash for missing distance or bp_rp on a star", () => {
    const star = {
      kind: "star",
      id: "star:1",
      source_id: "1",
      x: 400,
      y: 300,
      magnitude: 5.5,
      bp_rp: null,
      distance_ly: null,
      alt: 10,
      az: 20,
      source: "Gaia DR3",
    };
    render(<SkyTooltip object={star} container={container} />);
    const dashes = screen.getAllByText(/—/);
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("renders planet tooltip with AU distance and JPL source", () => {
    const jupiter = {
      kind: "planet",
      id: "planet:Jupiter",
      name: "Jupiter",
      x: 400,
      y: 300,
      distance_au: 5.03,
      alt: 31.7,
      az: 124.9,
      source: "JPL DE421 via Astropy",
    };
    render(<SkyTooltip object={jupiter} container={container} />);
    expect(screen.getByText(/Jupiter/)).toBeInTheDocument();
    expect(screen.getByText(/5\.03 AU/)).toBeInTheDocument();
    expect(screen.getByText(/31\.7°/)).toBeInTheDocument();
    expect(screen.getByText(/Source: JPL DE421 via Astropy/)).toBeInTheDocument();
  });

  it("renders Moon tooltip with illumination and phase", () => {
    const moon = {
      kind: "planet",
      id: "planet:Moon",
      name: "Moon",
      x: 400,
      y: 300,
      distance_au: 0.0026,
      alt: 60,
      az: 180,
      illumination: 0.5,
      phase_name: "first quarter",
      source: "JPL DE421 via Astropy",
    };
    render(<SkyTooltip object={moon} container={container} />);
    expect(screen.getByText(/Moon/)).toBeInTheDocument();
    expect(screen.getByText(/50%/)).toBeInTheDocument();
    expect(screen.getByText(/first quarter/i)).toBeInTheDocument();
  });

  it("flips to left side when anchor is near the right edge", () => {
    const star = {
      kind: "star",
      id: "star:1",
      source_id: "1",
      x: 1180,
      y: 300,
      magnitude: 1,
      bp_rp: 0.5,
      distance_ly: 10,
      alt: 45,
      az: 90,
      source: "Gaia DR3",
    };
    const { container: c } = render(
      <SkyTooltip object={star} container={container} />
    );
    const tooltip = c.firstChild;
    const leftPx = parseFloat(tooltip.style.left);
    expect(leftPx).toBeLessThan(1180);
  });
});
