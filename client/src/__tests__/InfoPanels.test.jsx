import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LunarPanel from "../components/info/LunarPanel.jsx";
import PlanetsPanel from "../components/info/PlanetsPanel.jsx";

const query = (planets) => ({
  isLoading: false,
  isError: false,
  data: { planets },
  refetch: () => {},
});

const SOURCE = "JPL DE421 via Astropy";

describe("info panels with below-horizon bodies", () => {
  it("lunar panel still reports the phase when the Moon is down", () => {
    render(
      <LunarPanel
        query={query([
          { name: "moon", alt: -20, az: 100, distance_au: 0.0026, phase_angle: 60,
            illumination: 0.75, phase_name: "waxing gibbous", source: SOURCE },
        ])}
      />
    );
    expect(screen.getByText("waxing gibbous")).toBeInTheDocument();
    expect(screen.getByText(/below the horizon/i)).toBeInTheDocument();
  });

  it("lunar panel does not flag a Moon that is up", () => {
    render(
      <LunarPanel
        query={query([
          { name: "moon", alt: 30, az: 100, distance_au: 0.0026, phase_angle: 60,
            illumination: 0.75, phase_name: "waxing gibbous", source: SOURCE },
        ])}
      />
    );
    expect(screen.queryByText(/below the horizon/i)).not.toBeInTheDocument();
  });

  it("planets panel lists set planets, struck through", () => {
    render(
      <PlanetsPanel
        query={query([
          { name: "mars", alt: -5, az: 90, distance_au: 1.5, source: SOURCE },
          { name: "jupiter", alt: 40, az: 180, distance_au: 5.0, source: SOURCE },
        ])}
      />
    );
    expect(screen.getByText("Mars").closest("tr")).toHaveClass("line-through");
    expect(screen.getByText("Jupiter").closest("tr")).not.toHaveClass("line-through");
  });
});
