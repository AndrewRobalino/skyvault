import { create } from "zustand";

/**
 * Visual chrome state. Orthogonal to observerStore — changes here do not
 * re-render semantic consumers.
 *
 *   introState   — "pending" | "playing" | "done"
 *   activityState — "normal" | "glass" (idle dims the chrome; it never hides it)
 *   prefersReducedMotion — reflects @media (prefers-reduced-motion: reduce)
 *   showConstellations — constellation overlay toggle (default off)
 */
export const useUiStateStore = create((set) => ({
  introState: "pending",
  activityState: "normal",
  prefersReducedMotion: false,

  setIntroState: (introState) => set({ introState }),

  // Called on every mousemove: returning the same state object when nothing
  // changes means Zustand notifies no one.
  markActive: () =>
    set((s) => (s.activityState === "normal" ? s : { activityState: "normal" })),

  markGlass: () => set({ activityState: "glass" }),

  setReducedMotion: (prefersReducedMotion) => set({ prefersReducedMotion }),

  showConstellations: false,

  toggleConstellations: () =>
    set((s) => ({ showConstellations: !s.showConstellations })),

  setShowConstellations: (showConstellations) => set({ showConstellations }),
}));
