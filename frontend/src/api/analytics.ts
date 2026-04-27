import { apiRequest } from "./client";

export interface AnalyticsFilters {
  country?: string;
  commodity?: string;
  tier?: string;
  riskLevel?: string;
}

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

export interface CountryAnalysisItem {
  country: string;
  supplierCount: number;
  avgOverallRisk: number;
  avgOperationalRisk: number;
  avgEsgRisk: number;
  expiringCertifications: number;
  expiredCertifications: number;
}

export interface CountryAnalysisResponse {
  countries: CountryAnalysisItem[];
}

export interface CommodityAnalysisItem {
  commodity: string;
  supplierCount: number;
  avgOverallRisk: number;
  avgOperationalRisk: number;
  avgEsgRisk: number;
  deforestationRiskScore: number;
  avgVolume: number;
}

export interface CommodityAnalysisResponse {
  commodities: CommodityAnalysisItem[];
}

export interface SupplierRankingItem {
  supplierId: number;
  supplierName: string;
  country: string | null;
  tier: string | null;
  overallRiskScore: number;
  operationalRiskScore: number;
  esgRiskScore: number;
  riskLevel: string;
  primaryDriver: string;
}

export interface SupplierRankingsResponse {
  topOverallRisk: SupplierRankingItem[];
  topOperationalRisk: SupplierRankingItem[];
  topEsgRisk: SupplierRankingItem[];
  lowestRisk: SupplierRankingItem[];
}

export interface CertificationCountryItem {
  country: string;
  valid: number;
  expiringSoon: number;
  expired: number;
}

export interface CertificationSupplierItem {
  supplierId: number;
  supplierName: string;
  country: string | null;
  valid: number;
  expiringSoon: number;
  expired: number;
}

export interface CertificationAnalysisResponse {
  byCountry: CertificationCountryItem[];
  topSuppliers: CertificationSupplierItem[];
}

export interface EsgPillarCountryItem {
  country: string;
  environmental: number;
  social: number;
  governance: number;
}

export interface EsgPillarSupplierItem {
  supplierId: number;
  supplierName: string;
  country: string | null;
  environmental: number;
  social: number;
  governance: number;
}

export interface EsgPillarAnalysisResponse {
  byCountry: EsgPillarCountryItem[];
  topSuppliers: EsgPillarSupplierItem[];
}

export interface OperationalTrendPoint {
  period: string;
  avgDelayDays: number;
  avgDefectRatePct: number;
  avgCostVariancePct: number;
  transactionCount: number;
}

export interface CertificationTimelinePoint {
  period: string;
  issuedCount: number;
  expiringCount: number;
  expiredCount: number;
}

export interface TrendSeriesPoint {
  period: string;
  value: number;
}

export interface TrendSeries {
  name: string;
  points: TrendSeriesPoint[];
}

export interface TrendAnalysisResponse {
  operational: OperationalTrendPoint[];
  certificationTimeline: CertificationTimelinePoint[];
  countryTrends: TrendSeries[];
  commodityTrends: TrendSeries[];
}

export interface HistogramBin {
  label: string;
  start: number;
  end: number;
  count: number;
}

export interface RiskDistributionsResponse {
  overall: HistogramBin[];
  operational: HistogramBin[];
  esg: HistogramBin[];
}

function buildAnalyticsQuery(filters?: AnalyticsFilters): string {
  const params = new URLSearchParams();
  if (filters?.country) params.set("country", filters.country);
  if (filters?.commodity) params.set("commodity", filters.commodity);
  if (filters?.tier) params.set("tier", filters.tier);
  if (filters?.riskLevel) params.set("riskLevel", filters.riskLevel);
  const query = params.toString();
  return query ? `?${query}` : "";
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

export async function getCountryAnalysis(): Promise<CountryAnalysisResponse> {
  return apiRequest<CountryAnalysisResponse>("/analytics/country-analysis");
}

export async function getCountryAnalysisWithFilters(
  filters?: AnalyticsFilters,
): Promise<CountryAnalysisResponse> {
  return apiRequest<CountryAnalysisResponse>(
    `/analytics/country-analysis${buildAnalyticsQuery(filters)}`,
  );
}

export async function getCommodityAnalysis(
  filters?: AnalyticsFilters,
): Promise<CommodityAnalysisResponse> {
  return apiRequest<CommodityAnalysisResponse>(
    `/analytics/commodity-analysis${buildAnalyticsQuery(filters)}`,
  );
}

export async function getSupplierRankings(
  limit = 8,
  filters?: AnalyticsFilters,
): Promise<SupplierRankingsResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (filters?.country) params.set("country", filters.country);
  if (filters?.commodity) params.set("commodity", filters.commodity);
  if (filters?.tier) params.set("tier", filters.tier);
  if (filters?.riskLevel) params.set("riskLevel", filters.riskLevel);
  return apiRequest<SupplierRankingsResponse>(`/analytics/supplier-rankings?${params.toString()}`);
}

export async function getCertificationAnalysis(
  limit = 8,
): Promise<CertificationAnalysisResponse> {
  return apiRequest<CertificationAnalysisResponse>(
    `/analytics/certification-analysis?limit=${limit}`,
  );
}

export async function getRiskDistributions(
  bins = 20,
  filters?: AnalyticsFilters,
): Promise<RiskDistributionsResponse> {
  const params = new URLSearchParams();
  params.set("bins", String(bins));
  if (filters?.country) params.set("country", filters.country);
  if (filters?.commodity) params.set("commodity", filters.commodity);
  if (filters?.tier) params.set("tier", filters.tier);
  if (filters?.riskLevel) params.set("riskLevel", filters.riskLevel);
  return apiRequest<RiskDistributionsResponse>(`/analytics/risk-distributions?${params.toString()}`);
}

export async function getEsgDistribution(): Promise<HistogramBin[]> {
  return apiRequest<HistogramBin[]>("/analytics/esg-distribution");
}

export async function getEsgPillarAnalysis(
  filters?: AnalyticsFilters,
): Promise<EsgPillarAnalysisResponse> {
  return apiRequest<EsgPillarAnalysisResponse>(
    `/analytics/esg-pillar-analysis${buildAnalyticsQuery(filters)}`,
  );
}

export async function getTrendAnalysis(
  filters?: AnalyticsFilters,
): Promise<TrendAnalysisResponse> {
  return apiRequest<TrendAnalysisResponse>(`/analytics/trend-analysis${buildAnalyticsQuery(filters)}`);
}
