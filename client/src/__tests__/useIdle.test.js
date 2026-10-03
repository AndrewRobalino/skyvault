import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIdle } from "../hooks/useIdle.js";
import { useUiStateStore } from "../stores/uiStateStore.js";

describe("useIdle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUiStateStore.setState({
      introState: "done",
      activityState: "normal",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("transitions normal -> glass after 15s of inactivity", () => {
    renderHook(() => useIdle({ enabled: true }));
    act(() => {
      vi.advanceTimersByTime(15_500);
    });
    expect(useUiStateStore.getState().activityState).toBe("glass");
  });

  it("never goes past glass, however long the user is idle", () => {
    // Reading a panel IS idle. Fading the UI to nothing made the lunar panel
    // vanish mid-read; idle now only dims.
    renderHook(() => useIdle({ enabled: true }));
    act(() => {
      vi.advanceTimersByTime(15_500);
      vi.advanceTimersByTime(120_000);
    });
    expect(useUiStateStore.getState().activityState).toBe("glass");
  });

  it("mouse activity resets state to normal", () => {
    renderHook(() => useIdle({ enabled: true }));
    act(() => {
      vi.advanceTimersByTime(15_500);
    });
    expect(useUiStateStore.getState().activityState).toBe("glass");

    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove"));
    });
    expect(useUiStateStore.getState().activityState).toBe("normal");
  });

  it("does nothing when enabled=false", () => {
    renderHook(() => useIdle({ enabled: false }));
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(useUiStateStore.getState().activityState).toBe("normal");
  });
});
