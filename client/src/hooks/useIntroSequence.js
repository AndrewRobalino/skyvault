import { useEffect } from "react";
import { useUiStateStore } from "../stores/uiStateStore.js";

/**
 * Determines whether the intro should play on mount and orchestrates the
 * state transitions. Intro fires on every page load. The intro is a soft
 * opacity fade (no motion, pan, or zoom), so it does NOT gate on
 * prefers-reduced-motion — fades aren't a vestibular hazard. We still
 * detect the preference and store it so motion-heavy code (Phase 4 3D)
 * can read it from `useUiStateStore`.
 */
export function useIntroSequence() {
  const { introState, setIntroState, setReducedMotion, markGlass, markActive } =
    useUiStateStore();

  // Effect 1: decide whether to play or skip (runs once when pending)
  useEffect(() => {
    if (introState !== "pending") return;

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);

    setIntroState("playing");
  }, [introState, setIntroState, setReducedMotion, markActive, markGlass]);

  // Effect 2: run the timer while playing (cleanup only fires when
  // introState leaves "playing", not when it enters it)
  useEffect(() => {
    if (introState !== "playing") return;

    const doneTimer = setTimeout(() => {
      setIntroState("done");
      markGlass();
    }, 4500);

    return () => clearTimeout(doneTimer);
  }, [introState, setIntroState, markGlass]);
}
