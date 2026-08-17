import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useObject } from "../hooks/useObject.js";
import { api } from "../api/client.js";

vi.mock("../api/client.js", () => ({
  api: { object: vi.fn() },
}));

function wrapper({ children }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => vi.clearAllMocks());

describe("useObject", () => {
  it("does not fetch when disabled", () => {
    renderHook(() => useObject("123", false), { wrapper });
    expect(api.object).not.toHaveBeenCalled();
  });

  it("does not fetch when sourceId is null", () => {
    renderHook(() => useObject(null, true), { wrapper });
    expect(api.object).not.toHaveBeenCalled();
  });

  it("fetches when enabled with a sourceId", async () => {
    api.object.mockResolvedValue({ found: true, enrichment: { proper_name: "Vega" } });
    const { result } = renderHook(() => useObject("123", true), { wrapper });
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(api.object).toHaveBeenCalledWith("123");
    expect(result.current.data.enrichment.proper_name).toBe("Vega");
  });
});
