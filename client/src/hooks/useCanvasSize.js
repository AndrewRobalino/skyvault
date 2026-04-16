import { useEffect, useRef, useState } from "react";

/**
 * Observe a container ref's rendered size and the current devicePixelRatio.
 * Output is debounced 150ms so window drags don't thrash downstream consumers.
 *
 * Returns { width, height, dpr } in CSS pixels and raw DPR ratio.
 * width/height start at 0 and update once ResizeObserver fires.
 */
const DEBOUNCE_MS = 150;

export function useCanvasSize(ref) {
  const [size, setSize] = useState({
    width: 0,
    height: 0,
    dpr: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
  });
  const timerRef = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const dpr = window.devicePixelRatio || 1;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setSize({ width, height, dpr });
      }, DEBOUNCE_MS);
    });
    ro.observe(el);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ro.disconnect();
    };
  }, [ref]);

  // Respond to DPR changes (multi-monitor drag) via matchMedia.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia(
      `(resolution: ${window.devicePixelRatio}dppx)`
    );
    const handler = () => {
      setSize((prev) => ({ ...prev, dpr: window.devicePixelRatio || 1 }));
    };
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  return size;
}
