import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";

export function usePlanets(selected, datetimeUtc) {
  return useQuery({
    queryKey: ["planets", selected?.lat, selected?.lon, datetimeUtc],
    queryFn: () => api.planets(selected.lat, selected.lon, datetimeUtc),
    enabled: Boolean(selected && datetimeUtc),
    staleTime: 5 * 60 * 1000,
  });
}
