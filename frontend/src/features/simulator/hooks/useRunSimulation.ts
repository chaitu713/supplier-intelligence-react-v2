import { useMutation } from "@tanstack/react-query";

import {
  runSimulation,
  type SimulatorScenarioRequest,
} from "../../../api/simulator";

export function useRunSimulation() {
  return useMutation({
    mutationFn: (payload: SimulatorScenarioRequest) => runSimulation(payload),
  });
}
