import { apiRequest } from "./client";

export interface OverviewMetrics {
  totalSuppliers: number;
  avgEsgScore: number;
  avgDelayDays: number;
  avgDefectRatePct: number;
  highRiskCount: number;
}

export interface CountryDistributionItem {
  country: string;
  supplierCount: number;
}

export interface HistogramBin {
  label: string;
  start: number;
  end: number;
  count: number;
}

export async function getOverviewMetrics(): Promise<OverviewMetrics> {
  return apiRequest<OverviewMetrics>("/analytics/overview");
}

export async function getCountryDistribution(): Promise<CountryDistributionItem[]> {
  return apiRequest<CountryDistributionItem[]>("/analytics/country-distribution");
}

export async function getEsgDistribution(): Promise<HistogramBin[]> {
  return apiRequest<HistogramBin[]>("/analytics/esg-distribution");
}
