import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIntroSequence } from "../hooks/useIntroSequence.js";
import { useUiStateStore } from "../stores/uiStateStore.js";

describe("useIntroSequence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    useUiStateStore.setState({
      introState: "pending",
      activityState: "normal",
      prefersReducedMotion: false,
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("plays intro on first mount when sessionStorage flag is unset", () => {
    renderHook(() => useIntroSequence());
    expect(useUiStateStore.getState().introState).toBe("playing");
  });

  it("skips intro when sessionStorage flag is set", () => {
    sessionStorage.setItem("skyvault.introPlayed", "true");
    renderHook(() => useIntroSequence());
    expect(useUiStateStore.getState().introState).toBe("done");
  });

  it("skips intro when prefers-reduced-motion is reduce", () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    renderHook(() => useIntroSequence());
    expect(useUiStateStore.getState().introState).toBe("done");
    expect(useUiStateStore.getState().prefersReducedMotion).toBe(true);
  });

  it("transitions to done after the intro duration", () => {
    renderHook(() => useIntroSequence());
    expect(useUiStateStore.getState().introState).toBe("playing");
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(useUiStateStore.getState().introState).toBe("done");
    expect(sessionStorage.getItem("skyvault.introPlayed")).toBe("true");
  });
});
