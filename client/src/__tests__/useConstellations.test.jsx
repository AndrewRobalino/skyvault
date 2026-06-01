import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useConstellations } from "../hooks/useConstellations.js";
import { api } from "../api/client.js";

vi.mock("../api/client.js", () => ({
  api: { constellations: vi.fn() },
}));

function wrapper({ children }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const selected = { lat: 40.7, lon: -74.0 };
const dt = "2026-06-01T04:00:00Z";

beforeEach(() => vi.clearAllMocks());

describe("useConstellations", () => {
  it("does not fetch when enabled flag is false", () => {
    renderHook(() => useConstellations(selected, dt, false), { wrapper });
    expect(api.constellations).not.toHaveBeenCalled();
  });

  it("fetches when enabled and observer present", async () => {
    api.constellations.mockResolvedValue({ constellations: [], count: 0, source: {} });
    renderHook(() => useConstellations(selected, dt, true), { wrapper });
    await waitFor(() => expect(api.constellations).toHaveBeenCalledWith(40.7, -74.0, dt));
  });
});
