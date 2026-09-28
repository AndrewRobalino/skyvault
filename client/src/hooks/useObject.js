import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";

/**
 * Fetch baked enrichment for a single star by Gaia DR3 source_id.
 * Gated: fires only when `enabled` and a `sourceId` is present (i.e. a star is
 * selected). Cached per source_id, so re-clicking a star is instant.
 */
export function useObject(sourceId, enabled) {
  return useQuery({
    queryKey: ["object", sourceId],
    queryFn: () => api.object(sourceId),
    enabled: Boolean(enabled && sourceId),
    staleTime: Infinity,
  });
}
