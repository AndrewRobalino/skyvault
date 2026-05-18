import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "../App.jsx";

describe("<App> smoke test", () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem("skyvault.introPlayed", "true");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ query: "", candidates: [], count: 0 }),
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it("mounts without throwing and renders the header eyebrow", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    expect(screen.getByText(/OBSERVATORIUM · SKYVAULT/i)).toBeInTheDocument();
  });

  it("renders the sky chart idle state", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );
    expect(screen.getByText(/pick a date and location/i)).toBeInTheDocument();
  });

  it("renders the EXPLORE IN 3D stub button", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );
    expect(screen.getByText(/EXPLORE IN 3D/i)).toBeInTheDocument();
  });
});
