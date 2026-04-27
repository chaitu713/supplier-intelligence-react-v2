import { useQuery } from "@tanstack/react-query";

import { getExecutiveDashboard } from "../../../api/analytics";

export function useExecutiveDashboard() {
  return useQuery({
    queryKey: ["analytics", "executive-dashboard"],
    queryFn: getExecutiveDashboard,
  });
}
