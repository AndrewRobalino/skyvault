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

describe("SkyTooltip planet body texture thumbnail", () => {
  it("shows the photoreal texture thumbnail for a planet", () => {
    const obj = {
      kind: "planet",
      name: "Jupiter",
      x: 500, y: 500,
      alt: 45, az: 180,
      distance_au: 4.5,
      source: "JPL DE421 via Astropy",
    };
    render(<SkyTooltip object={obj} container={container} />);
    const img = screen.getByAltText("Jupiter");
    expect(img.getAttribute("src")).toContain("/textures/planets/jupiter.jpg");
  });

  it("does not show a thumbnail for the Sun (procedural, no texture)", () => {
    const obj = {
      kind: "planet",
      name: "Sun",
      x: 500, y: 500,
      alt: 30, az: 90,
      distance_au: 1.0,
      source: "JPL DE421 via Astropy",
    };
    render(<SkyTooltip object={obj} container={container} />);
    expect(screen.queryByAltText("Sun")).toBeNull();
  });
});

describe("SkyTooltip DSO body", () => {
  it("renders DSO metadata", () => {
    const obj = {
      kind: "dso",
      id: "dso:M31",
      common_name: "Andromeda Galaxy",
      messier_id: "M31",
      type: "galaxy",
      x: 500, y: 500,
      alt: 45, az: 90,
      magnitude: 3.44,
      angular_size_arcmin: 178,
      minor_axis_arcmin: 63,
      position_angle_deg: 35,
      source: "SIMBAD/CDS",
    };
    render(<SkyTooltip object={obj} container={container} />);
    expect(screen.getByText("Andromeda Galaxy")).toBeInTheDocument();
    expect(screen.getAllByText(/Galaxy/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/SIMBAD\/CDS/)).toBeInTheDocument();
    expect(screen.getByText(/3.44/)).toBeInTheDocument();
  });
});

const baseStar = {
  kind: "star",
  source_id: "2667000000000000000",
  magnitude: 0.03,
  bp_rp: 0.13,
  distance_ly: 25.0,
  alt: 60,
  az: 120,
  source: "Gaia DR3",
  x: 100,
  y: 100,
};

describe("SkyTooltip star enrichment", () => {
  it("falls back to the Gaia id header when there is no enrichment", () => {
    render(<SkyTooltip object={baseStar} container={container} />);
    // Match the id line specifically — a bare /Gaia DR3/ is ambiguous, since
    // the source footer carries the same string.
    expect(
      screen.getByText(`Gaia DR3 · ${baseStar.source_id}`)
    ).toBeInTheDocument();
    expect(screen.getByText("Star")).toBeInTheDocument();
  });

  it("shows the proper name and spectral type when enriched", () => {
    const enrichment = {
      source_id: baseStar.source_id,
      proper_name: "Vega",
      designation: "α Lyrae",
      catalog_ids: ["HD 172167"],
      spectral_type: "A0Va",
      planets: null,
      sources: ["SIMBAD/CDS"],
    };
    render(
      <SkyTooltip object={baseStar} enrichment={enrichment} container={container} />
    );
    // Rendered uppercase via CSS text-transform, so the accessible text — and
    // what RTL matches on — is still the original "Vega".
    expect(screen.getByText("Vega")).toBeInTheDocument();
    expect(screen.getByText(/α Lyrae/)).toBeInTheDocument();
    expect(screen.getByText("A0Va")).toBeInTheDocument();
    expect(screen.getByText(/No known planets/)).toBeInTheDocument();
  });

  it("shows confirmed planet count for a host", () => {
    const enrichment = {
      source_id: baseStar.source_id,
      proper_name: "51 Pegasi",
      designation: "51 Peg",
      catalog_ids: ["HD 217014"],
      spectral_type: "G2IV",
      planets: { count: 1, names: ["51 Peg b"] },
      sources: ["SIMBAD/CDS", "NASA Exoplanet Archive"],
    };
    render(
      <SkyTooltip object={baseStar} enrichment={enrichment} container={container} />
    );
    expect(screen.getByText(/1 confirmed planet\b/)).toBeInTheDocument();
    expect(screen.getByText(/NASA Exoplanet Archive/)).toBeInTheDocument();
  });

  it("pluralizes the planet count for multi-planet hosts", () => {
    const enrichment = {
      source_id: baseStar.source_id,
      proper_name: "55 Cancri",
      designation: "55 Cancri",
      catalog_ids: ["HD 75732"],
      spectral_type: "G8V",
      planets: { count: 5, names: ["55 Cnc b", "55 Cnc c"] },
      sources: ["SIMBAD/CDS", "NASA Exoplanet Archive"],
    };
    render(
      <SkyTooltip object={baseStar} enrichment={enrichment} container={container} />
    );
    expect(screen.getByText(/5 confirmed planets/)).toBeInTheDocument();
  });

  it("shows a loading shimmer while enrichment loads", () => {
    render(
      <SkyTooltip
        object={baseStar}
        enrichmentLoading={true}
        container={container}
      />
    );
    expect(screen.getByTestId("enrichment-loading")).toBeInTheDocument();
  });
});
