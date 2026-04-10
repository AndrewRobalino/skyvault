import { useEffect } from "react";
import { useUiStateStore } from "../stores/uiStateStore.js";

const STORAGE_KEY = "skyvault.introPlayed";

/**
 * Determines whether the intro should play on mount and orchestrates the
 * state transitions. Uses sessionStorage so the intro fires on a fresh tab
 * but not on in-tab refreshes. ?replay in the URL forces a replay without
 * clearing the flag.
 *
 * Respects prefers-reduced-motion: reduce -> skip directly to DONE.
 */
export function useIntroSequence() {
  const { introState, setIntroState, setReducedMotion, markGlass, markActive } =
    useUiStateStore();

  useEffect(() => {
    if (introState !== "pending") return;

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduced = mql.matches;
    setReducedMotion(reduced);

    const url = new URL(window.location.href);
    const forceReplay = url.searchParams.has("replay");
    const alreadyPlayed = sessionStorage.getItem(STORAGE_KEY) === "true";

    if ((alreadyPlayed && !forceReplay) || reduced) {
      setIntroState("done");
      markActive();
      try {
        sessionStorage.setItem(STORAGE_KEY, "true");
      } catch {
        // sessionStorage unavailable (e.g. private mode) — ignore
      }
      return;
    }

    setIntroState("playing");

    // Total sequence ~4500ms (1500ms black -> 2000ms galaxy fade -> 1000ms overlap)
    const doneTimer = setTimeout(() => {
      setIntroState("done");
      markGlass();
      try {
        sessionStorage.setItem(STORAGE_KEY, "true");
      } catch {
        // ignore
      }
    }, 4500);

    return () => clearTimeout(doneTimer);
  }, [introState, setIntroState, setReducedMotion, markActive, markGlass]);
}
