import { useQuery } from "@tanstack/react-query";

import { getSupplierRankings, type AnalyticsFilters } from "../../../api/analytics";

export function useSupplierRankings(limit = 8, filters?: AnalyticsFilters) {
  return useQuery({
    queryKey: ["analytics", "supplier-rankings", limit, filters],
    queryFn: () => getSupplierRankings(limit, filters),
  });
}
