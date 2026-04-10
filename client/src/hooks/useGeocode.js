import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";

/**
 * Fetch place-name candidates from /api/v1/geocode.
 *
 * Fires only when `geocodeRequested` is true AND `query.length >= 2`.
 * The flag is set by `observerStore.submit()` when the user clicks Submit,
 * implementing the submit-then-pick model (live autocomplete is Phase 4).
 */
export function useGeocode(query, geocodeRequested) {
  return useQuery({
    queryKey: ["geocode", query],
    queryFn: () => api.geocode(query),
    enabled: Boolean(geocodeRequested && query && query.length >= 2),
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}
