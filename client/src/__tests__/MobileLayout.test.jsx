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

  it("the disabled 'Explore in 3D' placeholder is hidden on phones so it can't cover the sky", () => {
    const { getByText } = renderHero();
    const wrapper = getByText(/explore in 3d/i).closest("div.absolute");
    expect(wrapper.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(wrapper.className).toMatch(/md:block/);
  });
});
