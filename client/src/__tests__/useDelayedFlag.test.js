import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDelayedFlag } from "../hooks/useDelayedFlag.js";

afterEach(() => vi.useRealTimers());

describe("useDelayedFlag", () => {
  it("turns on only after the delay and resets when inactive", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ on }) => useDelayedFlag(on, 3000), {
      initialProps: { on: true },
    });
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(3100));
    expect(result.current).toBe(true);
    rerender({ on: false });
    expect(result.current).toBe(false);
  });
});
