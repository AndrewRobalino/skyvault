import { describe, it, expect, beforeEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import PlanetLabels from "../components/hero/PlanetLabels.jsx";

describe("PlanetLabels", () => {
  beforeEach(() => cleanup());

  const sample = (overrides) => ({
    kind: "planet",
    id: "planet:Test",
    name: "Test",
    x: 100,
    y: 100,
    alt: 30,
    az: 90,
    ...overrides,
  });

  it("renders a label per visible planet (alt > 0)", () => {
    const planets = [
      sample({ name: "Mars", alt: 45 }),
      sample({ name: "Jupiter", alt: 30 }),
      sample({ name: "Venus", alt: 10 }),
    ];
    render(<PlanetLabels projectedPlanets={planets} width={1000} />);
    expect(screen.getByText("Mars")).toBeTruthy();
    expect(screen.getByText("Jupiter")).toBeTruthy();
    expect(screen.getByText("Venus")).toBeTruthy();
  });

  it("does NOT render labels for below-horizon planets", () => {
    const planets = [
      sample({ name: "Saturn", alt: -10 }),
      sample({ name: "Mars", alt: 30 }),
    ];
    render(<PlanetLabels projectedPlanets={planets} width={1000} />);
    expect(screen.queryByText("Saturn")).toBeNull();
    expect(screen.getByText("Mars")).toBeTruthy();
  });

  it("Sun and Moon get labeled when above horizon", () => {
    const planets = [
      sample({ name: "Sun", alt: 20 }),
      sample({ name: "Moon", alt: 50 }),
    ];
    render(<PlanetLabels projectedPlanets={planets} width={1000} />);
    expect(screen.getByText("Sun")).toBeTruthy();
    expect(screen.getByText("Moon")).toBeTruthy();
  });

  it("flips label position to left when planet is in right 20% of canvas", () => {
    const planets = [sample({ name: "Mars", x: 900, y: 200, alt: 45 })];
    const { container } = render(<PlanetLabels projectedPlanets={planets} width={1000} />);
    const span = container.querySelector("span");
    expect(span.style.textAlign).toBe("right");
    expect(span.style.left).toMatch(/890px$/);
  });

  it("normal (left-side) label uses default offset (+10, -6)", () => {
    const planets = [sample({ name: "Mars", x: 100, y: 200, alt: 45 })];
    const { container } = render(<PlanetLabels projectedPlanets={planets} width={1000} />);
    const span = container.querySelector("span");
    expect(span.style.left).toMatch(/110px$/);
    expect(span.style.top).toMatch(/194px$/);
  });
});
