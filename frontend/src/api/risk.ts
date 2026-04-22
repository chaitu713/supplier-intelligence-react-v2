import { apiRequest } from "./client";

export interface RiskOverview {
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  avgRiskScore: number;
  avgOperationalRisk: number;
  avgEsgRisk: number;
  avgOverallRisk: number;
}

export interface RiskHistogramBin {
  label: string;
  start: number;
  end: number;
  count: number;
}

export interface RiskSegmentationItem {
  riskLevel: "High" | "Medium" | "Low";
  supplierCount: number;
}

export interface RiskSupplierItem {
  supplierId: number;
  supplierName: string;
  country: string | null;
  category: string | null;
  tier: string | null;
  avgDelay: number;
  avgDefect: number;
  avgCostVariance: number;
  operationalRiskScore: number;
  esgRiskScore: number;
  overallRiskScore: number;
  riskScore: number;
  operationalRiskLevel: "High" | "Medium" | "Low";
  esgRiskLevel: "High" | "Medium" | "Low";
  riskLevel: "High" | "Medium" | "Low";
}

export interface DueDiligenceResponse {
  supplier: string;
  opRisk: string;
  opRiskScore: number;
  esgRisk: string;
  esgRiskScore: number;
  overall: string;
  overallRiskScore: number;
  issues: string[];
  aiSummary: string;
}

export async function getRiskOverview(): Promise<RiskOverview> {
  return apiRequest<RiskOverview>("/risk/overview");
}

export async function getRiskDistribution(): Promise<RiskHistogramBin[]> {
  return apiRequest<RiskHistogramBin[]>("/risk/distribution");
}

export async function getRiskSegmentation(): Promise<RiskSegmentationItem[]> {
  return apiRequest<RiskSegmentationItem[]>("/risk/segmentation");
}

export async function getTopRiskSuppliers(): Promise<RiskSupplierItem[]> {
  return apiRequest<RiskSupplierItem[]>("/risk/top-suppliers");
}

export async function runDueDiligence(supplierId: number): Promise<DueDiligenceResponse> {
  return apiRequest<DueDiligenceResponse>("/risk/due-diligence", {
    method: "POST",
    json: { supplierId },
  });
}
