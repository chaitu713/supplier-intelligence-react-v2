import { useQuery } from "@tanstack/react-query";

import { getTrendAnalysis, type AnalyticsFilters } from "../../../api/analytics";

export function useTrendAnalysis(filters?: AnalyticsFilters) {
  return useQuery({
    queryKey: ["analytics", "trend-analysis", filters],
    queryFn: () => getTrendAnalysis(filters),
  });
}
