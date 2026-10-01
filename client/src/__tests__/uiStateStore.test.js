import { describe, it, expect, beforeEach } from "vitest";
import { useUiStateStore } from "../stores/uiStateStore.js";

describe("uiStateStore", () => {
  beforeEach(() => {
    useUiStateStore.setState({
      introState: "pending",
      activityState: "normal",
      prefersReducedMotion: false,
    });
  });

  it("has sane defaults", () => {
    const s = useUiStateStore.getState();
    expect(s.introState).toBe("pending");
    expect(s.activityState).toBe("normal");
    expect(s.prefersReducedMotion).toBe(false);
  });

  it("setIntroState transitions through pending -> playing -> done", () => {
    const store = useUiStateStore.getState();
    store.setIntroState("playing");
    expect(useUiStateStore.getState().introState).toBe("playing");
    store.setIntroState("done");
    expect(useUiStateStore.getState().introState).toBe("done");
  });

  it("markActive sets activityState back to normal", () => {
    useUiStateStore.setState({ activityState: "glass" });
    useUiStateStore.getState().markActive();
    expect(useUiStateStore.getState().activityState).toBe("normal");
  });

  it("markActive while already normal notifies nobody", () => {
    // It runs on every mousemove; a fresh state object each time re-rendered
    // every whole-store subscriber on every pointer movement.
    let notifications = 0;
    const unsubscribe = useUiStateStore.subscribe(() => {
      notifications += 1;
    });
    useUiStateStore.getState().markActive();
    useUiStateStore.getState().markActive();
    unsubscribe();
    expect(notifications).toBe(0);
  });

  it("markGlass sets activityState directly", () => {
    useUiStateStore.getState().markGlass();
    expect(useUiStateStore.getState().activityState).toBe("glass");
  });

  it("setReducedMotion updates the flag", () => {
    useUiStateStore.getState().setReducedMotion(true);
    expect(useUiStateStore.getState().prefersReducedMotion).toBe(true);
  });
});

describe("showConstellations", () => {
  it("defaults to false", () => {
    expect(useUiStateStore.getState().showConstellations).toBe(false);
  });

  it("toggleConstellations flips the flag", () => {
    useUiStateStore.getState().toggleConstellations();
    expect(useUiStateStore.getState().showConstellations).toBe(true);
    useUiStateStore.getState().toggleConstellations();
    expect(useUiStateStore.getState().showConstellations).toBe(false);
  });
});
