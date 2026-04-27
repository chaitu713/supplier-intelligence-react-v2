import { apiRequest } from "./client";

export type SupplierDisruptionSeverity = "moderate" | "severe" | "unavailable";

export interface SupplierDisruptionScenarioRequest {
  scenarioType: "supplier_disruption";
  supplierId: number;
  severity: SupplierDisruptionSeverity;
}

export interface SimulatorKpiSummary {
  highRiskSuppliers: number;
  mediumRiskSuppliers: number;
  lowRiskSuppliers: number;
  avgOverallRisk: number;
  avgOperationalRisk: number;
  avgEsgRisk: number;
}

export interface SimulatorDeltaSummary {
  highRiskSuppliers: number;
  mediumRiskSuppliers: number;
  lowRiskSuppliers: number;
  avgOverallRisk: number;
  avgOperationalRisk: number;
  avgEsgRisk: number;
}

export interface SimulatorRiskBandMovement {
  fromBand: string;
  toBand: string;
  supplierCount: number;
}

export interface SimulatorAffectedSupplierItem {
  supplierId: number;
  supplierName: string;
  country: string | null;
  beforeOverallRisk: number;
  afterOverallRisk: number;
  deltaOverallRisk: number;
  beforeRiskLevel: string;
  afterRiskLevel: string;
  impactReason: string;
}

export interface SupplierDisruptionScenarioMeta {
  scenarioType: string;
  severity: SupplierDisruptionSeverity;
  supplierId: number;
  supplierName: string;
  country: string | null;
}

export interface SupplierDisruptionScenarioResponse {
  scenario: SupplierDisruptionScenarioMeta;
  before: SimulatorKpiSummary;
  after: SimulatorKpiSummary;
  deltas: SimulatorDeltaSummary;
  riskBandMovement: SimulatorRiskBandMovement[];
  affectedSuppliers: SimulatorAffectedSupplierItem[];
}

export async function runSupplierDisruptionScenario(
  payload: SupplierDisruptionScenarioRequest,
): Promise<SupplierDisruptionScenarioResponse> {
  return apiRequest<SupplierDisruptionScenarioResponse>("/simulator/run", {
    method: "POST",
    json: payload,
  });
}
