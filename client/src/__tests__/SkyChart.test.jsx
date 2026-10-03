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
vi.mock("../hooks/useDso.js", () => ({
  useDso: vi.fn(),
}));
vi.mock("../hooks/useConstellations.js", () => ({
  useConstellations: vi.fn(),
}));
vi.mock("../utils/snapshot.js", () => ({
  saveSnapshot: vi.fn(async () => {}),
}));

import { useSky } from "../hooks/useSky.js";
import { usePlanets } from "../hooks/usePlanets.js";
import { useDso } from "../hooks/useDso.js";
import { useConstellations } from "../hooks/useConstellations.js";
import { useUiStateStore } from "../stores/uiStateStore.js";
import { saveSnapshot } from "../utils/snapshot.js";

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
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  clip: vi.fn(),
  closePath: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  set fillStyle(_) {},
  set strokeStyle(_) {},
  set lineWidth(_) {},
  set globalAlpha(_) {},
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
  useDso.mockReturnValue(mockQuery({}));
  useConstellations.mockReturnValue(mockQuery({}));
  useUiStateStore.setState({ showConstellations: false });
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
    useDso.mockReturnValue(mockQuery({ isLoading: true }));
    renderWithProviders(<SkyChart />);
    expect(screen.getByText(/Computing sky/i)).toBeInTheDocument();
    expect(screen.getByText(/Miami, FL/)).toBeInTheDocument();
  });

  it("error state renders an error affordance and retry triggers refetches", () => {
    useObserverStore.getState().useCurrentLocation(25.76, -80.19, "Miami, FL");
    const skyRefetch = vi.fn();
    const planetsRefetch = vi.fn();
    const dsoRefetch = vi.fn();
    useSky.mockReturnValue(
      mockQuery({ isError: true, error: { status: 500 }, refetch: skyRefetch })
    );
    usePlanets.mockReturnValue(mockQuery({ refetch: planetsRefetch }));
    useDso.mockReturnValue(mockQuery({ refetch: dsoRefetch }));
    renderWithProviders(<SkyChart />);
    const retryBtn = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(skyRefetch).toHaveBeenCalled();
    expect(planetsRefetch).toHaveBeenCalled();
    expect(dsoRefetch).toHaveBeenCalled();
  });

  it("ready state renders cardinal labels N/S/E/W", () => {
    useObserverStore.getState().useCurrentLocation(25.76, -80.19, "Miami, FL");
    useSky.mockReturnValue(
      mockQuery({ data: { observer: {}, stars: [], count: 0 } })
    );
    usePlanets.mockReturnValue(
      mockQuery({ data: { observer: {}, planets: [], count: 0 } })
    );
    useDso.mockReturnValue(
      mockQuery({ data: { observer: {}, dsos: [], count: 0 } })
    );
    renderWithProviders(<SkyChart />);
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.getByText("N")).toBeInTheDocument();
    expect(screen.getByText("S")).toBeInTheDocument();
    expect(screen.getByText("E")).toBeInTheDocument();
    expect(screen.getByText("W")).toBeInTheDocument();
  });

  it("mounts the AttributionFooter (Phase 2c license-critical attribution)", () => {
    renderWithProviders(<SkyChart />);
    expect(screen.getByText(/Brunier/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /data credits/i })).toBeInTheDocument();
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
    useDso.mockReturnValue(
      mockQuery({ data: { observer: {}, dsos: [], count: 0 } })
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

  it("renders constellation labels when the toggle is on and data present", () => {
    useObserverStore.getState().useCurrentLocation(25.76, -80.19, "Miami, FL");
    useUiStateStore.setState({ showConstellations: true });
    useSky.mockReturnValue(mockQuery({ data: { observer: {}, stars: [], count: 0 } }));
    usePlanets.mockReturnValue(mockQuery({ data: { observer: {}, planets: [], count: 0 } }));
    useDso.mockReturnValue(mockQuery({ data: { observer: {}, dsos: [], count: 0 } }));
    useConstellations.mockReturnValue(
      mockQuery({
        data: {
          constellations: [
            {
              id: "Ori",
              name: "Orion",
              segments: [{ from_alt: 45, from_az: 90, to_alt: 50, to_az: 95, visible: true }],
              label_alt: 80,
              label_az: 90,
              label_visible: true,
            },
          ],
        },
      })
    );
    renderWithProviders(<SkyChart />);
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.getByText("Orion")).toBeInTheDocument();
  });

  it("does NOT render constellation labels when the toggle is off", () => {
    useObserverStore.getState().useCurrentLocation(25.76, -80.19, "Miami, FL");
    useUiStateStore.setState({ showConstellations: false });
    useSky.mockReturnValue(mockQuery({ data: { observer: {}, stars: [], count: 0 } }));
    usePlanets.mockReturnValue(mockQuery({ data: { observer: {}, planets: [], count: 0 } }));
    useDso.mockReturnValue(mockQuery({ data: { observer: {}, dsos: [], count: 0 } }));
    useConstellations.mockReturnValue(
      mockQuery({
        data: {
          constellations: [
            { id: "Ori", name: "Orion",
              segments: [{ from_alt: 45, from_az: 90, to_alt: 50, to_az: 95, visible: true }],
              label_alt: 80, label_az: 90, label_visible: true },
          ],
        },
      })
    );
    renderWithProviders(<SkyChart />);
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.queryByText("Orion")).not.toBeInTheDocument();
  });

  it("a planets failure still renders the star chart, with a notice", () => {
    // e.g. a date past JPL DE421 coverage: stars are fine, planets are not.
    useObserverStore.getState().useCurrentLocation(25.76, -80.19, "Miami, FL");
    useSky.mockReturnValue(mockQuery({ data: { observer: {}, stars: [], count: 0 } }));
    usePlanets.mockReturnValue(
      mockQuery({
        isError: true,
        error: { status: 422, message: "Planet positions are only available from 1899-07-29 to 2053-10-09" },
      })
    );
    useDso.mockReturnValue(mockQuery({ data: { observer: {}, dsos: [], count: 0 } }));
    renderWithProviders(<SkyChart />);
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.getByText("N")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/only available from 1899/);
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("below-horizon planets are never hit-testable", () => {
    useObserverStore.getState().useCurrentLocation(25.76, -80.19, "Miami, FL");
    useSky.mockReturnValue(mockQuery({ data: { observer: {}, stars: [], count: 0 } }));
    usePlanets.mockReturnValue(
      mockQuery({
        data: {
          observer: {},
          count: 1,
          planets: [{ name: "jupiter", alt: -5, az: 90, distance_au: 5, source: "JPL DE421 via Astropy" }],
        },
      })
    );
    useDso.mockReturnValue(mockQuery({ data: { observer: {}, dsos: [], count: 0 } }));
    const { container } = renderWithProviders(<SkyChart />);
    act(() => { vi.advanceTimersByTime(200); });
    const root = container.querySelector("[role='img']");
    root.getBoundingClientRect = () => ({
      left: 0, top: 0, right: 800, bottom: 450, width: 800, height: 450,
    });
    // alt -5, az 90 projects to (154.5, 225), just outside the horizon circle.
    fireEvent.click(root, { clientX: 155, clientY: 225 });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("clicks inside the tooltip or on the toggle keep the selection", () => {
    useObserverStore.getState().useCurrentLocation(25.76, -80.19, "Miami, FL");
    useSky.mockReturnValue(
      mockQuery({
        data: {
          observer: {},
          count: 1,
          stars: [{ source_id: "7", ra: 0, dec: 0, alt: 90, az: 0, magnitude: 1, bp_rp: 0 }],
        },
      })
    );
    usePlanets.mockReturnValue(mockQuery({ data: { observer: {}, planets: [], count: 0 } }));
    useDso.mockReturnValue(mockQuery({ data: { observer: {}, dsos: [], count: 0 } }));
    const { container } = renderWithProviders(<SkyChart />);
    act(() => { vi.advanceTimersByTime(200); });
    const root = container.querySelector("[role='img']");
    root.getBoundingClientRect = () => ({
      left: 0, top: 0, right: 800, bottom: 450, width: 800, height: 450,
    });
    fireEvent.click(root, { clientX: 400, clientY: 225 });
    fireEvent.click(screen.getByRole("dialog"), { clientX: 10, clientY: 10 });
    expect(screen.getByText(/Gaia DR3 · 7/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /constellations/i }), {
      clientX: 10,
      clientY: 10,
    });
    expect(screen.getByText(/Gaia DR3 · 7/)).toBeInTheDocument();
  });

  it("offers Save image only once the sky is ready", () => {
    renderWithProviders(<SkyChart />);
    expect(screen.queryByRole("button", { name: /save image/i })).not.toBeInTheDocument();
  });

  it("Save image exports what is on screen, without touching the selection", async () => {
    saveSnapshot.mockClear();
    useObserverStore.getState().useCurrentLocation(25.76, -80.19, "Miami, FL");
    const stars = [{ source_id: "7", ra: 0, dec: 0, alt: 90, az: 0, magnitude: 1, bp_rp: 0 }];
    const planets = [{ name: "mars", alt: 20, az: 100, distance_au: 1 }];
    useSky.mockReturnValue(mockQuery({ data: { observer: {}, stars, count: 1 } }));
    usePlanets.mockReturnValue(mockQuery({ data: { observer: {}, planets, count: 1 } }));
    useDso.mockReturnValue(mockQuery({ data: { observer: {}, dsos: [], count: 0 } }));
    useConstellations.mockReturnValue(
      mockQuery({ data: { constellations: [{ id: "Ori", name: "Orion", segments: [] }] } })
    );
    const { container } = renderWithProviders(<SkyChart />);
    act(() => { vi.advanceTimersByTime(200); });
    container.querySelector("[role='img']").getBoundingClientRect = () => ({
      left: 0, top: 0, right: 800, bottom: 450, width: 800, height: 450,
    });

    // Constellations are off, so none are exported even though data exists.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save image/i }), {
        clientX: 400,
        clientY: 225,
      });
    });
    expect(saveSnapshot).toHaveBeenCalledTimes(1);
    const args = saveSnapshot.mock.calls[0][0];
    expect(args.selected.displayName).toBe("Miami, FL");
    expect(args.datetimeUtc).toBe(useObserverStore.getState().datetimeUtc);
    expect(args.stars).toBe(stars);
    expect(args.planets).toBe(planets);
    expect(args.constellations).toEqual([]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Save image includes constellations when the overlay is on", async () => {
    saveSnapshot.mockClear();
    useObserverStore.getState().useCurrentLocation(25.76, -80.19, "Miami, FL");
    useUiStateStore.setState({ showConstellations: true });
    const figures = [{ id: "Ori", name: "Orion", segments: [] }];
    useSky.mockReturnValue(mockQuery({ data: { observer: {}, stars: [], count: 0 } }));
    usePlanets.mockReturnValue(mockQuery({ data: { observer: {}, planets: [], count: 0 } }));
    useDso.mockReturnValue(mockQuery({ data: { observer: {}, dsos: [], count: 0 } }));
    useConstellations.mockReturnValue(mockQuery({ data: { constellations: figures } }));
    renderWithProviders(<SkyChart />);
    act(() => { vi.advanceTimersByTime(200); });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save image/i }));
    });
    expect(saveSnapshot.mock.calls[0][0].constellations).toBe(figures);
  });

  it("Save image shows progress and recovers if the export fails", async () => {
    let fail;
    saveSnapshot.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    useObserverStore.getState().useCurrentLocation(25.76, -80.19, "Miami, FL");
    useSky.mockReturnValue(mockQuery({ data: { observer: {}, stars: [], count: 0 } }));
    usePlanets.mockReturnValue(mockQuery({ data: { observer: {}, planets: [], count: 0 } }));
    useDso.mockReturnValue(mockQuery({ data: { observer: {}, dsos: [], count: 0 } }));
    renderWithProviders(<SkyChart />);
    act(() => { vi.advanceTimersByTime(200); });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save image/i }));
    });
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();

    await act(async () => {
      fail(new Error("boom"));
    });
    expect(screen.getByRole("button", { name: /save image/i })).toBeEnabled();
  });

  it("a phone-sized chart still draws every star (the look comes from marker scale)", () => {
    // Matches the downloaded snapshot, which shows all stars and looks right.
    class SmallRO {
      constructor(cb) { this.cb = cb; }
      observe(el) { this.cb([{ target: el, contentRect: { width: 340, height: 340 } }]); }
      disconnect() {}
    }
    global.ResizeObserver = SmallRO;
    useObserverStore.getState().useCurrentLocation(25.76, -80.19, "Miami, FL");
    useSky.mockReturnValue(
      mockQuery({
        data: {
          observer: {},
          count: 1,
          stars: [{ source_id: "faint", ra: 0, dec: 0, alt: 90, az: 0, magnitude: 6.3, bp_rp: 0 }],
        },
      })
    );
    usePlanets.mockReturnValue(mockQuery({ data: { observer: {}, planets: [], count: 0 } }));
    useDso.mockReturnValue(mockQuery({ data: { observer: {}, dsos: [], count: 0 } }));
    const { container } = renderWithProviders(<SkyChart />);
    act(() => { vi.advanceTimersByTime(200); });
    const root = container.querySelector("[role='img']");
    root.getBoundingClientRect = () => ({ left: 0, top: 0, right: 340, bottom: 340, width: 340, height: 340 });
    fireEvent.click(root, { clientX: 170, clientY: 170 });
    expect(screen.getByText(/Gaia DR3 · faint/)).toBeInTheDocument();
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
    useDso.mockReturnValue(
      mockQuery({ data: { observer: {}, dsos: [], count: 0 } })
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
