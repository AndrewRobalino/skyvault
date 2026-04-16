import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SkyChart from "../components/hero/SkyChart.jsx";
import { useObserverStore } from "../stores/observerStore.js";

vi.mock("../hooks/useSky.js", () => ({
  useSky: vi.fn(),
}));
vi.mock("../hooks/usePlanets.js", () => ({
  usePlanets: vi.fn(),
}));

import { useSky } from "../hooks/useSky.js";
import { usePlanets } from "../hooks/usePlanets.js";

HTMLCanvasElement.prototype.getContext = () => ({
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  arc: vi.fn(),
  beginPath: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  ellipse: vi.fn(),
  fillRect: vi.fn(),
  set fillStyle(_) {},
  set strokeStyle(_) {},
  set lineWidth(_) {},
  set globalCompositeOperation(_) {},
});

class MockRO {
  constructor(cb) { this.cb = cb; }
  observe(el) {
    this.cb([{ target: el, contentRect: { width: 800, height: 450 } }]);
  }
  disconnect() {}
}

function renderWithProviders(ui) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function resetStore() {
  useObserverStore.getState().reset();
}

function mockQuery(overrides) {
  return {
    data: null,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  resetStore();
  global.ResizeObserver = MockRO;
  useSky.mockReturnValue(mockQuery({}));
  usePlanets.mockReturnValue(mockQuery({}));
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("<SkyChart>", () => {
  it("idle state renders 'Pick a date and location'", () => {
    renderWithProviders(<SkyChart />);
    expect(screen.getByText(/Pick a date and location/i)).toBeInTheDocument();
  });

  it("loading state shows the selected place name", () => {
    useObserverStore.getState().useCurrentLocation(25.76, -80.19, "Miami, FL");
    useSky.mockReturnValue(mockQuery({ isLoading: true }));
    usePlanets.mockReturnValue(mockQuery({ isLoading: true }));
    renderWithProviders(<SkyChart />);
    expect(screen.getByText(/Computing sky/i)).toBeInTheDocument();
    expect(screen.getByText(/Miami, FL/)).toBeInTheDocument();
  });

  it("error state renders an error affordance and retry triggers refetches", () => {
    useObserverStore.getState().useCurrentLocation(25.76, -80.19, "Miami, FL");
    const skyRefetch = vi.fn();
    const planetsRefetch = vi.fn();
    useSky.mockReturnValue(
      mockQuery({ isError: true, error: { status: 500 }, refetch: skyRefetch })
    );
    usePlanets.mockReturnValue(mockQuery({ refetch: planetsRefetch }));
    renderWithProviders(<SkyChart />);
    const retryBtn = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(skyRefetch).toHaveBeenCalled();
    expect(planetsRefetch).toHaveBeenCalled();
  });

  it("ready state renders cardinal labels N/S/E/W", () => {
    useObserverStore.getState().useCurrentLocation(25.76, -80.19, "Miami, FL");
    useSky.mockReturnValue(
      mockQuery({ data: { observer: {}, stars: [], count: 0 } })
    );
    usePlanets.mockReturnValue(
      mockQuery({ data: { observer: {}, planets: [], count: 0 } })
    );
    renderWithProviders(<SkyChart />);
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.getByText("N")).toBeInTheDocument();
    expect(screen.getByText("S")).toBeInTheDocument();
    expect(screen.getByText("E")).toBeInTheDocument();
    expect(screen.getByText("W")).toBeInTheDocument();
  });

  it("click on an object shows the tooltip; click empty area dismisses it", () => {
    useObserverStore.getState().useCurrentLocation(25.76, -80.19, "Miami, FL");
    useSky.mockReturnValue(
      mockQuery({
        data: {
          observer: {},
          count: 1,
          stars: [
            {
              source_id: "42",
              ra: 0,
              dec: 0,
              alt: 90,
              az: 0,
              magnitude: -1.46,
              bp_rp: 0.02,
              distance_ly: 8.6,
              parallax_mas: 379,
              teff_k: 9940,
            },
          ],
        },
      })
    );
    usePlanets.mockReturnValue(
      mockQuery({ data: { observer: {}, planets: [], count: 0 } })
    );
    const { container } = renderWithProviders(<SkyChart />);
    act(() => { vi.advanceTimersByTime(200); });

    const root = container.querySelector("[role='img']");
    expect(root).toBeTruthy();

    root.getBoundingClientRect = () => ({
      left: 0, top: 0, right: 800, bottom: 450, width: 800, height: 450,
    });
    fireEvent.click(root, { clientX: 400, clientY: 225 });
    expect(screen.getByText(/Gaia DR3 · 42/)).toBeInTheDocument();

    fireEvent.click(root, { clientX: 10, clientY: 10 });
    expect(screen.queryByText(/Gaia DR3 · 42/)).not.toBeInTheDocument();
  });

  it("Escape keypress clears an active selection", () => {
    useObserverStore.getState().useCurrentLocation(25.76, -80.19, "Miami, FL");
    useSky.mockReturnValue(
      mockQuery({
        data: {
          observer: {},
          count: 1,
          stars: [
            { source_id: "7", ra: 0, dec: 0, alt: 90, az: 0, magnitude: 1, bp_rp: 0 },
          ],
        },
      })
    );
    usePlanets.mockReturnValue(
      mockQuery({ data: { observer: {}, planets: [], count: 0 } })
    );
    const { container } = renderWithProviders(<SkyChart />);
    act(() => { vi.advanceTimersByTime(200); });
    const root = container.querySelector("[role='img']");
    root.getBoundingClientRect = () => ({
      left: 0, top: 0, right: 800, bottom: 450, width: 800, height: 450,
    });
    fireEvent.click(root, { clientX: 400, clientY: 225 });
    expect(screen.getByText(/Gaia DR3 · 7/)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText(/Gaia DR3 · 7/)).not.toBeInTheDocument();
  });
});
