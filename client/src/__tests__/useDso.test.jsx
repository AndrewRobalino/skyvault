import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDso } from "../hooks/useDso.js";

vi.mock("../api/client.js", () => ({
  api: {
    dso: vi.fn(async () => ({
      observer: { lat: 40, lon: -74, datetime: "2026-08-15T02:00:00Z" },
      dsos: [{ id: "M31", common_name: "Andromeda" }],
      count: 1,
    })),
  },
}));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "QueryWrapper";
  return Wrapper;
}

describe("useDso", () => {
  it("does not fetch when selected is null", async () => {
    const { api } = await import("../api/client.js");
    api.dso.mockClear();
    renderHook(() => useDso(null, "2026-08-15T02:00:00Z"), { wrapper: wrap() });
    expect(api.dso).not.toHaveBeenCalled();
  });

  it("fetches when selected and datetimeUtc both present", async () => {
    const { api } = await import("../api/client.js");
    api.dso.mockClear();
    const { result } = renderHook(
      () => useDso({ lat: 40.7128, lon: -74.0060 }, "2026-08-15T02:00:00Z"),
      { wrapper: wrap() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.dso).toHaveBeenCalledWith(40.7128, -74.0060, "2026-08-15T02:00:00Z");
    expect(result.current.data.dsos).toHaveLength(1);
  });
});
