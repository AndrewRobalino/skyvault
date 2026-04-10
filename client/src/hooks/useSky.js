import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";

export function useSky(selected, datetimeUtc) {
  return useQuery({
    queryKey: ["sky", selected?.lat, selected?.lon, datetimeUtc],
    queryFn: () => api.sky(selected.lat, selected.lon, datetimeUtc),
    enabled: Boolean(selected && datetimeUtc),
    staleTime: 5 * 60 * 1000,
  });
}
