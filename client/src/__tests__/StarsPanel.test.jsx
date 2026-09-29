import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import StarsPanel from "../components/info/StarsPanel.jsx";

const star = (overrides) => ({
  source_id: "4089383515393106688",
  magnitude: 3.2,
  alt: 40,
  az: 100,
  bp_rp: 0.5,
  distance_ly: 50,
  source: "Gaia DR3",
  ...overrides,
});

const query = (stars) => ({ isLoading: false, isError: false, data: { stars } });

describe("<StarsPanel>", () => {
  it("labels each row with the catalog it came from", () => {
    render(
      <StarsPanel
        query={query([
          star({ source_id: "hip:32349", magnitude: -1.49, source: "ESA Hipparcos" }),
          star(),
        ])}
      />
    );
    expect(screen.getByText("HIP")).toBeInTheDocument();
    expect(screen.getByText("32349")).toBeInTheDocument();
    expect(screen.getByText("Gaia")).toBeInTheDocument();
    expect(screen.getByText("515393106688".slice(-9))).toBeInTheDocument();
  });

  it("credits every catalog present in the list", () => {
    render(
      <StarsPanel
        query={query([
          star({ source_id: "hip:32349", magnitude: -1.49, source: "ESA Hipparcos" }),
          star(),
        ])}
      />
    );
    expect(screen.getByText("ESA Hipparcos · Gaia DR3")).toBeInTheDocument();
  });

  it("credits only Gaia when no supplement star is listed", () => {
    render(<StarsPanel query={query([star()])} />);
    expect(screen.getByText("Gaia DR3")).toBeInTheDocument();
  });
});
