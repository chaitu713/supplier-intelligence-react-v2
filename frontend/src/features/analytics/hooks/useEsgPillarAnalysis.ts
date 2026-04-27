import { useQuery } from "@tanstack/react-query";

import { getEsgPillarAnalysis, type AnalyticsFilters } from "../../../api/analytics";

export function useEsgPillarAnalysis(filters?: AnalyticsFilters, limit = 8) {
  return useQuery({
    queryKey: ["analytics", "esg-pillar-analysis", filters, limit],
    queryFn: () => getEsgPillarAnalysis(filters),
  });
}
