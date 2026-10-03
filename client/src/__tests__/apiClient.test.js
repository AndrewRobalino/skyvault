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

describe("API base URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("calls an absolute API origin when VITE_API_BASE is set (production)", async () => {
    vi.stubEnv("VITE_API_BASE", "https://skyvault-api-abc.a.run.app/api/v1");
    vi.resetModules();
    const { api: prodApi } = await import("../api/client.js");
    const fetchMock = stubFetch();
    await prodApi.dso(1, 2, "2026-01-15T02:00:00.000Z");
    expect(fetchMock.mock.calls[0][0]).toMatch(/^https:\/\/skyvault-api-abc\.a\.run\.app\/api\/v1\/dso\?/);
  });

  it("health pings the API origin's /health and swallows failures", async () => {
    vi.stubEnv("VITE_API_BASE", "https://skyvault-api-abc.a.run.app/api/v1");
    vi.resetModules();
    const { api: prodApi } = await import("../api/client.js");
    const fetchMock = vi.fn(async () => {
      throw new TypeError("offline");
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(prodApi.health()).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toBe("https://skyvault-api-abc.a.run.app/health");
  });
});
