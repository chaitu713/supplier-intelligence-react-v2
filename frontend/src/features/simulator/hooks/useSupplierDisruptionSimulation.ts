import { useMutation } from "@tanstack/react-query";

import {
  runSupplierDisruptionScenario,
  type SupplierDisruptionScenarioRequest,
} from "../../../api/simulator";

export function useSupplierDisruptionSimulation() {
  return useMutation({
    mutationFn: (payload: SupplierDisruptionScenarioRequest) =>
      runSupplierDisruptionScenario(payload),
  });
}
