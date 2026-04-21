import { useQuery } from "@tanstack/react-query";

import {
  getCountryDistribution,
  getEsgDistribution,
  getOverviewMetrics,
} from "../../../api/analytics";

export function useOverviewMetrics() {
  return useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: getOverviewMetrics,
  });
}

export function useCountryDistribution() {
  return useQuery({
    queryKey: ["analytics", "country-distribution"],
    queryFn: getCountryDistribution,
  });
}

export function useEsgDistribution() {
  return useQuery({
    queryKey: ["analytics", "esg-distribution"],
    queryFn: getEsgDistribution,
  });
}
