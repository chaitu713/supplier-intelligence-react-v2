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
  caseId: string | null;
  supplier: string;
  supplierId: number | null;
  country: string | null;
  tier: string | null;
  status: string | null;
  opRisk: string;
  opRiskScore: number;
  esgRisk: string;
  esgRiskScore: number;
  overall: string;
  overallRiskScore: number;
  decision: string | null;
  decisionRationale: string[];
  investigationChecklist: Array<{ label: string; status: string; detail: string }>;
  riskDrivers: Array<{ label: string; value: number; status: string }>;
  evidenceGaps: string[];
  recommendedActions: string[];
  connectedSignals: Record<string, unknown>;
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
