import { create } from "zustand";

/**
 * Visual chrome state. Orthogonal to observerStore — changes here do not
 * re-render semantic consumers.
 *
 *   introState   — "pending" | "playing" | "done"
 *   activityState — "normal" | "glass" | "hidden"
 *   lastActivityAt — epoch ms of the last meaningful user input
 *   prefersReducedMotion — reflects @media (prefers-reduced-motion: reduce)
 */
export const useUiStateStore = create((set) => ({
  introState: "pending",
  activityState: "normal",
  lastActivityAt: Date.now(),
  prefersReducedMotion: false,

  setIntroState: (introState) => set({ introState }),

  markActive: () =>
    set({ activityState: "normal", lastActivityAt: Date.now() }),

  markGlass: () => set({ activityState: "glass" }),

  markHidden: () => set({ activityState: "hidden" }),

  setReducedMotion: (prefersReducedMotion) => set({ prefersReducedMotion }),
}));
