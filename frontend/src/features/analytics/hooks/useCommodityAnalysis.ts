import { useQuery } from "@tanstack/react-query";

import { getCommodityAnalysis, type AnalyticsFilters } from "../../../api/analytics";

export function useCommodityAnalysis(filters?: AnalyticsFilters) {
  return useQuery({
    queryKey: ["analytics", "commodity-analysis", filters],
    queryFn: () => getCommodityAnalysis(filters),
  });
}
