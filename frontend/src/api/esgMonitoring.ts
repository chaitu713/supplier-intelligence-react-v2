import { apiRequest } from "./client";

export interface EsgMonitoringKpi {
  totalSuppliers: number;
  highEsgRiskSuppliers: number;
  deterioratingSuppliers: number;
  openEsgAlerts: number;
  averageEsgHealth: number;
}

export interface EsgIndicatorSummary {
  key: string;
  label: string;
  category: string;
  averageRisk: number;
  highRiskSuppliers: number;
  trend: string;
  description: string;
  isPriority: boolean;
}

export interface EsgWatchlistSupplier {
  supplierId: number;
  supplierName: string;
  country: string | null;
  tier: string | null;
  esgRiskScore: number;
  esgHealthScore: number;
  bwsRisk: number;
  hrrRisk: number;
  landUseRisk: number;
  trend: string;
  status: string;
  primaryConcern: string;
  recommendedAction: string;
}

export interface EsgAlertItem {
  id: string;
  supplierId: number;
  supplierName: string;
  severity: string;
  indicator: string;
  message: string;
  recommendedAction: string;
}

export interface EsgHealthTrend {
  label: string;
  supplierCount: number;
}

export interface EsgMlFlaggedSupplier {
  supplierId: number;
  supplierName: string;
  anomalyScore: number;
  confidence: number;
  signal: string;
}

export interface EsgMlInsights {
  modelName: string;
  monitoringMode: string;
  flaggedSuppliers: number;
  averageAnomalyScore: number;
  topSignals: string[];
  dataLimitations: string[];
  flaggedSupplierDetails: EsgMlFlaggedSupplier[];
}

export interface EsgMonitoringOverview {
  kpis: EsgMonitoringKpi;
  indicators: EsgIndicatorSummary[];
  watchlist: EsgWatchlistSupplier[];
  alerts: EsgAlertItem[];
  healthTrends: EsgHealthTrend[];
  mlInsights: EsgMlInsights;
}

export async function getEsgMonitoringOverview(): Promise<EsgMonitoringOverview> {
  return apiRequest<EsgMonitoringOverview>("/esg-monitoring/overview");
}
