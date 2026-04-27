import { useQuery } from "@tanstack/react-query";

import { getCountryAnalysisWithFilters, type AnalyticsFilters } from "../../../api/analytics";

export function useCountryAnalysis(filters?: AnalyticsFilters) {
  return useQuery({
    queryKey: ["analytics", "country-analysis", filters],
    queryFn: () => getCountryAnalysisWithFilters(filters),
  });
}
