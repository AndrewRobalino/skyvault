import { describe, it, expect, vi, afterEach } from "vitest";
import { api } from "../api/client.js";

function stubFetch() {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ planets: [] }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api.planets", () => {
  it("asks for bodies below the horizon too", async () => {
    // The panels list every planet (set ones struck through) and the lunar
    // panel shows the phase even when the Moon is down; the chart itself
    // filters to alt >= 0.
    const fetchMock = stubFetch();
    await api.planets(25.76, -80.19, "2026-01-15T02:00:00.000Z");
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe("/api/v1/planets");
    expect(url.searchParams.get("include_below_horizon")).toBe("true");
  });
});
