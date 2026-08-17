import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";

/**
 * Constellation figures for the current observer. Gated on `enabled` (the
 * showConstellations toggle) so the layer costs nothing when off.
 */
export function useConstellations(selected, datetimeUtc, enabled) {
  return useQuery({
    queryKey: ["constellations", selected?.lat, selected?.lon, datetimeUtc],
    queryFn: () => api.constellations(selected.lat, selected.lon, datetimeUtc),
    enabled: Boolean(enabled && selected && datetimeUtc),
    staleTime: 5 * 60 * 1000,
  });
}
