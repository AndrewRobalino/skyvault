import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";

export function useDso(selected, datetimeUtc) {
  return useQuery({
    queryKey: ["dso", selected?.lat, selected?.lon, datetimeUtc],
    queryFn: () => api.dso(selected.lat, selected.lon, datetimeUtc),
    enabled: Boolean(selected && datetimeUtc),
    staleTime: 5 * 60 * 1000,
  });
}
