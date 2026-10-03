/**
 * Phone layout intent (jsdom has no media queries, so these pin the Tailwind
 * classes that implement it; the real check is the phone itself).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import HeroRegion from "../components/hero/HeroRegion.jsx";

vi.mock("../components/hero/SkyChart.jsx", () => ({ default: () => <div data-testid="chart" /> }));

beforeEach(() => {
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
});

function renderHero() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <HeroRegion />
    </QueryClientProvider>
  );
}

describe("phone layout", () => {
  it("the sky chart is a full-width square on phones, the wide box from md up", () => {
    const { container } = renderHero();
    const hero = container.querySelector("section");
    expect(hero.className).toMatch(/(^|\s)aspect-square(\s|$)/);
    expect(hero.className).toMatch(/md:aspect-auto/);
  });

  it("no Explore in 3D placeholder covers the sky (removed until Phase 4)", () => {
    const { queryByText } = renderHero();
    expect(queryByText(/explore in 3d/i)).toBeNull();
  });
});
