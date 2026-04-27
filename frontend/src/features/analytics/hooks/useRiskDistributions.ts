import { useQuery } from "@tanstack/react-query";

import { getRiskDistributions, type AnalyticsFilters } from "../../../api/analytics";

export function useRiskDistributions(bins = 20, filters?: AnalyticsFilters) {
  return useQuery({
    queryKey: ["analytics", "risk-distributions", bins, filters],
    queryFn: () => getRiskDistributions(bins, filters),
  });
}
