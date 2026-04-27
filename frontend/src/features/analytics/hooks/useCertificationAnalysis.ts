import { useQuery } from "@tanstack/react-query";

import { getCertificationAnalysis } from "../../../api/analytics";

export function useCertificationAnalysis(limit = 8) {
  return useQuery({
    queryKey: ["analytics", "certification-analysis", limit],
    queryFn: () => getCertificationAnalysis(limit),
  });
}
