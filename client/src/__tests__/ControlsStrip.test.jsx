import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ControlsStrip from "../components/controls/ControlsStrip.jsx";
import { useObserverStore } from "../stores/observerStore.js";

vi.mock("../hooks/useGeocode.js", () => ({ useGeocode: vi.fn() }));
import { useGeocode } from "../hooks/useGeocode.js";

function renderWithGeocodeError(status) {
  useGeocode.mockReturnValue({
    data: undefined,
    isError: true,
    isFetching: false,
    error: { status, message: "Geocoder upstream error" },
    refetch: vi.fn(),
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ControlsStrip />
    </QueryClientProvider>
  );
}

beforeEach(() => useObserverStore.getState().reset());

describe("<ControlsStrip> geocode errors", () => {
  it("a network failure (backend paused or offline) says so, not 'use your current location'", () => {
    // The place search is a visitor's first API call; when the whole backend
    // is down, blaming the geocoder sends them to GPS, which fails too.
    renderWithGeocodeError(0);
    expect(screen.getByText(/backend is temporarily offline/i)).toBeInTheDocument();
    expect(screen.queryByText(/use your current location/i)).not.toBeInTheDocument();
  });

  it.each([[502], [503]])("upstream lookup failure %s blames only the lookup service", (status) => {
    renderWithGeocodeError(status);
    expect(screen.getByText(/couldn't reach the place lookup service/i)).toBeInTheDocument();
  });
});
