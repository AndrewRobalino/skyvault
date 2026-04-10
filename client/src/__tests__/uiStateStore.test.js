import { describe, it, expect, beforeEach } from "vitest";
import { useUiStateStore } from "../stores/uiStateStore.js";

describe("uiStateStore", () => {
  beforeEach(() => {
    useUiStateStore.setState({
      introState: "pending",
      activityState: "normal",
      lastActivityAt: Date.now(),
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

  it("markActive sets activityState to normal and updates lastActivityAt", () => {
    const before = useUiStateStore.getState().lastActivityAt;
    useUiStateStore.setState({ activityState: "glass", lastActivityAt: 0 });
    useUiStateStore.getState().markActive();
    const after = useUiStateStore.getState();
    expect(after.activityState).toBe("normal");
    expect(after.lastActivityAt).toBeGreaterThan(before - 1);
  });

  it("markGlass and markHidden set activityState directly", () => {
    const store = useUiStateStore.getState();
    store.markGlass();
    expect(useUiStateStore.getState().activityState).toBe("glass");
    store.markHidden();
    expect(useUiStateStore.getState().activityState).toBe("hidden");
  });

  it("setReducedMotion updates the flag", () => {
    useUiStateStore.getState().setReducedMotion(true);
    expect(useUiStateStore.getState().prefersReducedMotion).toBe(true);
  });
});
