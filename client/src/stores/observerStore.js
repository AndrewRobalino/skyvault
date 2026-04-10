import { create } from "zustand";
import { toIsoUtc } from "../utils/formatDatetime.js";

/**
 * Semantic observer state: what the user wants to see.
 *
 *   rawQuery    — the string currently typed into LocationInput
 *   candidates  — geocode results after the user has submitted
 *   selected    — the chosen candidate (or current location)
 *   date/time   — user-chosen date and optional time
 *   timezone    — "Local" | "UTC"
 *   datetimeUtc — derived ISO 8601 UTC string (set on submit)
 *   submitted   — true once the user has clicked Submit and a candidate is picked
 *
 * Submit flow:
 *   1. User types + picks date + (optional) time, clicks Submit
 *   2. store.submit() sets `geocodeRequested = true` → useGeocode hook fires
 *   3. Backend returns candidates → store.setCandidates(candidates)
 *   4. DidYouMeanDropdown shows the list
 *   5. User clicks a candidate → store.selectCandidate(idx) sets selected + datetimeUtc
 *   6. useSky and usePlanets hooks (gated on `selected != null`) fire
 */
export const useObserverStore = create((set, get) => ({
  rawQuery: "",
  candidates: [],
  selected: null,
  date: "",
  time: "",
  timezone: "Local",
  datetimeUtc: null,
  submitted: false,
  geocodeRequested: false,

  setRawQuery: (rawQuery) => set({ rawQuery, candidates: [], selected: null }),

  setCandidates: (candidates) => set({ candidates }),

  selectCandidate: (idx) => {
    const { candidates, date, time, timezone } = get();
    const picked = candidates[idx];
    if (!picked) return;
    const datetimeUtc = toIsoUtc({ date, time, timezone });
    set({
      selected: {
        lat: picked.lat,
        lon: picked.lon,
        displayName: picked.display_name,
        country: picked.country ?? null,
      },
      datetimeUtc,
      submitted: true,
      geocodeRequested: false,
    });
  },

  useCurrentLocation: (lat, lon, displayName = "Current location") => {
    const { date, time, timezone } = get();
    const datetimeUtc = toIsoUtc({ date, time, timezone });
    set({
      selected: { lat, lon, displayName, country: null },
      candidates: [],
      datetimeUtc,
      submitted: true,
      geocodeRequested: false,
    });
  },

  setDate: (date) => set({ date }),
  setTime: (time) => set({ time }),
  setTimezone: (timezone) => set({ timezone }),

  submit: () => {
    const { rawQuery, date } = get();
    if (!rawQuery || rawQuery.length < 2 || !date) return;
    set({ geocodeRequested: true, submitted: false, selected: null });
  },

  reset: () =>
    set({
      rawQuery: "",
      candidates: [],
      selected: null,
      date: "",
      time: "",
      timezone: "Local",
      datetimeUtc: null,
      submitted: false,
      geocodeRequested: false,
    }),
}));
