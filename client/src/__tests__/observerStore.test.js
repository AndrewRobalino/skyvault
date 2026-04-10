import { describe, it, expect, beforeEach } from "vitest";
import { useObserverStore } from "../stores/observerStore.js";

const SAMPLE_CANDIDATES = [
  {
    display_name: "Portoviejo, Manabí, Ecuador",
    name: "Portoviejo",
    country: "Ecuador",
    state: "Manabí",
    lat: -1.0569,
    lon: -80.4544,
  },
  {
    display_name: "Paris, France",
    name: "Paris",
    country: "France",
    state: null,
    lat: 48.85,
    lon: 2.35,
  },
];

describe("observerStore", () => {
  beforeEach(() => {
    useObserverStore.getState().reset();
  });

  it("has sane defaults", () => {
    const s = useObserverStore.getState();
    expect(s.rawQuery).toBe("");
    expect(s.candidates).toEqual([]);
    expect(s.selected).toBeNull();
    expect(s.submitted).toBe(false);
    expect(s.geocodeRequested).toBe(false);
  });

  it("setRawQuery clears stale candidates and selection", () => {
    const store = useObserverStore.getState();
    store.setCandidates(SAMPLE_CANDIDATES);
    store.setRawQuery("Portoviejo");
    const s = useObserverStore.getState();
    expect(s.rawQuery).toBe("Portoviejo");
    expect(s.candidates).toEqual([]);
    expect(s.selected).toBeNull();
  });

  it("submit requires both query and date", () => {
    const store = useObserverStore.getState();
    store.submit();
    expect(useObserverStore.getState().geocodeRequested).toBe(false);

    store.setRawQuery("Portoviejo");
    store.submit();
    expect(useObserverStore.getState().geocodeRequested).toBe(false);

    store.setDate("2026-04-08");
    store.submit();
    expect(useObserverStore.getState().geocodeRequested).toBe(true);
  });

  it("selectCandidate populates selected and computes datetimeUtc", () => {
    const store = useObserverStore.getState();
    store.setRawQuery("Portoviejo");
    store.setDate("2026-04-08");
    store.setTime("22:00");
    store.setTimezone("UTC");
    store.setCandidates(SAMPLE_CANDIDATES);
    store.selectCandidate(0);

    const s = useObserverStore.getState();
    expect(s.selected).toEqual({
      lat: -1.0569,
      lon: -80.4544,
      displayName: "Portoviejo, Manabí, Ecuador",
      country: "Ecuador",
    });
    expect(s.submitted).toBe(true);
    expect(s.geocodeRequested).toBe(false);
    expect(s.datetimeUtc).toBe("2026-04-08T22:00:00.000Z");
  });

  it("selectCandidate with invalid index is a no-op", () => {
    const store = useObserverStore.getState();
    store.setDate("2026-04-08");
    store.setCandidates(SAMPLE_CANDIDATES);
    store.selectCandidate(99);
    expect(useObserverStore.getState().selected).toBeNull();
  });

  it("useCurrentLocation bypasses the geocoder", () => {
    const store = useObserverStore.getState();
    store.setDate("2026-04-08");
    store.setTime("12:00");
    store.setTimezone("UTC");
    store.useCurrentLocation(25.76, -80.19, "Current location");
    const s = useObserverStore.getState();
    expect(s.selected?.lat).toBe(25.76);
    expect(s.selected?.lon).toBe(-80.19);
    expect(s.selected?.displayName).toBe("Current location");
    expect(s.submitted).toBe(true);
    expect(s.datetimeUtc).toBe("2026-04-08T12:00:00.000Z");
  });

  it("reset clears all state", () => {
    const store = useObserverStore.getState();
    store.setRawQuery("Miami");
    store.setDate("2026-04-08");
    store.setCandidates(SAMPLE_CANDIDATES);
    store.selectCandidate(0);
    store.reset();
    const s = useObserverStore.getState();
    expect(s.rawQuery).toBe("");
    expect(s.date).toBe("");
    expect(s.selected).toBeNull();
  });
});
