import { apiRequest } from "./client";

export interface OverviewMetrics {
  totalSuppliers: number;
  avgEsgScore: number;
  avgDelayDays: number;
  avgDefectRatePct: number;
  highRiskCount: number;
}

export interface ExecutiveDashboardKpis {
  totalSuppliers: number;
  highRiskSuppliers: number;
  avgOverallRisk: number;
  avgOperationalRisk: number;
  avgEsgRisk: number;
  expiringOrExpiredCertifications: number;
}

export interface ExecutiveDashboardHealth {
  networkHealth: "Stable" | "Watch" | "At Risk";
  operationalStability: "Stable" | "Watch" | "At Risk";
  esgCompliance: "Stable" | "Watch" | "At Risk";
  suppliersNeedingReview: number;
}

export interface ExecutiveDashboardGeographyItem {
  country: string;
  supplierCount: number;
  riskLevel: "Stable" | "Watch" | "At Risk";
  avgOverallRisk: number;
  avgOperationalRisk: number;
  avgEsgRisk: number;
}

export interface ExecutiveDashboardSupplierItem {
  supplierId: number;
  supplierName: string;
  riskLevel: "High" | "Medium" | "Low";
  overallRiskScore: number;
  reason: string;
}

export interface ExecutiveDashboardCommodityItem {
  commodity: string;
  supplierCount: number;
}

export interface ExecutiveDashboardAttention {
  geographicExposure: ExecutiveDashboardGeographyItem[];
  commodityExposure: ExecutiveDashboardCommodityItem[];
  suppliersRequiringReview: ExecutiveDashboardSupplierItem[];
}

export interface ExecutiveDashboardRiskMix {
  high: number;
  medium: number;
  low: number;
}

export interface ExecutiveDashboardRiskMixGroup {
  high: number;
  medium: number;
  low: number;
}

export interface ExecutiveDashboardCertificationHealth {
  valid: number;
  expiringSoon: number;
  expired: number;
}

export interface ExecutiveDashboardResponse {
  reportingDate: string;
  kpis: ExecutiveDashboardKpis;
  health: ExecutiveDashboardHealth;
  riskMix: ExecutiveDashboardRiskMix;
  operationalRiskMix: ExecutiveDashboardRiskMixGroup;
  esgRiskMix: ExecutiveDashboardRiskMixGroup;
  certificationHealth: ExecutiveDashboardCertificationHealth;
  attention: ExecutiveDashboardAttention;
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

export async function getExecutiveDashboard(): Promise<ExecutiveDashboardResponse> {
  return apiRequest<ExecutiveDashboardResponse>("/analytics/executive-dashboard");
}

export async function getCountryDistribution(): Promise<CountryDistributionItem[]> {
  return apiRequest<CountryDistributionItem[]>("/analytics/country-distribution");
}

export async function getEsgDistribution(): Promise<HistogramBin[]> {
  return apiRequest<HistogramBin[]>("/analytics/esg-distribution");
}
