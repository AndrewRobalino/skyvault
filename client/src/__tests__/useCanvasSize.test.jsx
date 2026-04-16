import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { useRef } from "react";
import { useCanvasSize } from "../hooks/useCanvasSize.js";

// Minimal ResizeObserver mock — capture callback so tests can trigger it.
let resizeCallback = null;

class MockResizeObserver {
  constructor(cb) {
    resizeCallback = cb;
  }
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  resizeCallback = null;
  global.ResizeObserver = MockResizeObserver;
  window.devicePixelRatio = 1;
});

afterEach(() => {
  delete global.ResizeObserver;
});

function Probe({ onSize }) {
  const ref = useRef(null);
  const size = useCanvasSize(ref);
  onSize(size);
  return (
    <div
      ref={ref}
      data-testid="probe"
      style={{ width: 800, height: 450 }}
    />
  );
}

describe("useCanvasSize", () => {
  it("returns zero size before ResizeObserver fires", () => {
    let latest = null;
    render(<Probe onSize={(s) => (latest = s)} />);
    expect(latest).toEqual({ width: 0, height: 0, dpr: 1 });
  });

  it("updates to observed dimensions and reflects DPR", () => {
    vi.useFakeTimers();
    let latest = null;
    window.devicePixelRatio = 2;
    const { getByTestId } = render(<Probe onSize={(s) => (latest = s)} />);
    const el = getByTestId("probe");

    act(() => {
      resizeCallback([
        { target: el, contentRect: { width: 1200, height: 675 } },
      ]);
    });

    act(() => {
      vi.advanceTimersByTime(160);
    });

    expect(latest.width).toBe(1200);
    expect(latest.height).toBe(675);
    expect(latest.dpr).toBe(2);
    vi.useRealTimers();
  });

  it("debounces rapid resize events (coalesces to final value)", async () => {
    vi.useFakeTimers();
    let latest = null;
    const { getByTestId } = render(<Probe onSize={(s) => (latest = s)} />);
    const el = getByTestId("probe");

    act(() => {
      resizeCallback([{ target: el, contentRect: { width: 500, height: 300 } }]);
      resizeCallback([{ target: el, contentRect: { width: 700, height: 400 } }]);
      resizeCallback([{ target: el, contentRect: { width: 900, height: 500 } }]);
    });

    // Before debounce fires, nothing updates
    expect(latest.width).toBe(0);

    act(() => {
      vi.advanceTimersByTime(160);
    });

    expect(latest.width).toBe(900);
    expect(latest.height).toBe(500);
    vi.useRealTimers();
  });
});
