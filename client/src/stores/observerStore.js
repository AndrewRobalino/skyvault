import { create } from "zustand";
import { toIsoUtc, isSupportedDate } from "../utils/formatDatetime.js";

/**
 * Semantic observer state: what the user wants to see.
 *
 *   rawQuery    — the string currently typed into LocationInput
 *   candidates  — geocode results after the user has submitted
 *   selected    — the chosen candidate (or current location)
 *   date/time   — user-chosen date and optional time
 *   timezone    — "Local" | "UTC". "Local" is the SELECTED PLACE's zone
 *                 (selected.timezone, IANA), not the browser's.
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
    const zone = picked.timezone ?? null;
    const datetimeUtc = toIsoUtc({ date, time, timezone, zone });
    set({
      selected: {
        lat: picked.lat,
        lon: picked.lon,
        displayName: picked.display_name,
        country: picked.country ?? null,
        timezone: zone,
      },
      candidates: [],
      datetimeUtc,
      submitted: true,
      geocodeRequested: false,
    });
  },

  useCurrentLocation: (lat, lon, displayName = "Current location") => {
    const { date, time, timezone } = get();
    // A GPS fix is where the user is standing, so the browser's zone is the
    // place's zone.
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const datetimeUtc = toIsoUtc({ date, time, timezone, zone });
    set({
      selected: { lat, lon, displayName, country: null, timezone: zone },
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
    const { rawQuery, date, time, timezone, selected } = get();
    if (!rawQuery || rawQuery.length < 2 || !isSupportedDate(date)) return;

    // If the user already has a location selected, treat GO as
    // "recompute with the current date/time" — don't re-geocode and
    // don't drop the selection. Typing a new location clears
    // `selected` (see setRawQuery), which sends us through the
    // geocode path again on the next GO.
    if (selected) {
      set({
        datetimeUtc: toIsoUtc({ date, time, timezone, zone: selected.timezone }),
      });
      return;
    }

    set({ geocodeRequested: true, submitted: false });
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
