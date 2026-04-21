import { useMutation, useQuery } from "@tanstack/react-query";

import {
  getRiskDistribution,
  getRiskOverview,
  getRiskSegmentation,
  getTopRiskSuppliers,
  runDueDiligence,
} from "../../../api/risk";

export function useRiskOverview() {
  return useQuery({
    queryKey: ["risk", "overview"],
    queryFn: getRiskOverview,
  });
}

export function useRiskDistribution() {
  return useQuery({
    queryKey: ["risk", "distribution"],
    queryFn: getRiskDistribution,
  });
}

export function useRiskSegmentation() {
  return useQuery({
    queryKey: ["risk", "segmentation"],
    queryFn: getRiskSegmentation,
  });
}

export function useTopRiskSuppliers() {
  return useQuery({
    queryKey: ["risk", "top-suppliers"],
    queryFn: getTopRiskSuppliers,
  });
}

export function useDueDiligence() {
  return useMutation({
    mutationFn: runDueDiligence,
  });
}
