import { useEffect, useRef } from "react";
import { useUiStateStore } from "../stores/uiStateStore.js";

const ACTIVE_TO_GLASS_MS = 15_000;
const GLASS_TO_HIDDEN_MS = 5_000;

const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "touchstart",
  "scroll",
  "focusin",
];

/**
 * Observes user activity and walks the uiStateStore.activityState machine:
 *
 *   (initial after intro) GLASS
 *      | any activity -> NORMAL
 *      | 15s no activity -> GLASS
 *      | 5s more no activity -> HIDDEN
 *      | any activity -> NORMAL
 *
 * Visibility handling:
 *   - Hide tab: pause the timer, record `hiddenAt`
 *   - Show tab after <5s: resume
 *   - Show tab after >5s: snap to GLASS
 *
 * Focused input immunity:
 *   While document.activeElement is an input/textarea/select, treat
 *   activity as continuous.
 *
 * Reduced motion:
 *   Transitions still happen but CSS-side durations are neutralized via
 *   the global @media rule in global.css. We don't special-case here.
 */
export function useIdle({ enabled }) {
  const { markActive, markGlass, markHidden } = useUiStateStore();
  const timerRef = useRef(null);
  const hiddenAtRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const scheduleGlass = () => {
      clearTimer();
      timerRef.current = setTimeout(() => {
        markGlass();
        timerRef.current = setTimeout(() => {
          markHidden();
        }, GLASS_TO_HIDDEN_MS);
      }, ACTIVE_TO_GLASS_MS);
    };

    const isFormFocused = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };

    const onActivity = () => {
      markActive();
      scheduleGlass();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        clearTimer();
        hiddenAtRef.current = Date.now();
      } else if (document.visibilityState === "visible") {
        const hiddenFor = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0;
        hiddenAtRef.current = null;
        if (hiddenFor > 5000) {
          markGlass();
        } else {
          markActive();
        }
        scheduleGlass();
      }
    };

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Tick every second to keep focused-input state fresh without
    // requiring mousemove.
    const focusTicker = setInterval(() => {
      if (isFormFocused()) {
        markActive();
        scheduleGlass();
      }
    }, 1000);

    scheduleGlass();

    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(focusTicker);
      clearTimer();
    };
  }, [enabled, markActive, markGlass, markHidden]);
}
