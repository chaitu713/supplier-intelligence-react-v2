import { apiRequest } from "./client";

export interface RiskOverview {
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  avgRiskScore: number;
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
  avgDelay: number;
  avgDefect: number;
  avgCostVariance: number;
  riskScore: number;
  riskLevel: "High" | "Medium" | "Low";
}

export interface DueDiligenceResponse {
  supplier: string;
  opRisk: string;
  esgRisk: string;
  overall: string;
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
