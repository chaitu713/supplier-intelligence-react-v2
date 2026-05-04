import { useQuery } from "@tanstack/react-query";

import { getEsgMonitoringOverview } from "../../../api/esgMonitoring";

export function useEsgMonitoringOverview() {
  return useQuery({
    queryKey: ["esg-monitoring", "overview"],
    queryFn: getEsgMonitoringOverview,
  });
}
