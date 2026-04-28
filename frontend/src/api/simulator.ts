import { apiRequest } from "./client";

export type ScenarioType =
  | "supplier_disruption"
  | "country_disruption"
  | "commodity_shock"
  | "operational_deterioration";
export type SupplierDisruptionSeverity = "moderate" | "severe" | "unavailable";
export type OperationalTargetType = "supplier" | "country" | "commodity";

export interface SupplierDisruptionScenarioRequest {
  scenarioType: "supplier_disruption";
  supplierId: number;
  severity: SupplierDisruptionSeverity;
}

export interface OperationalDeteriorationScenarioRequest {
  scenarioType: "operational_deterioration";
  targetType: OperationalTargetType;
  targetValue: string;
  delayIncreasePct: number;
  defectIncreasePct: number;
  costVarianceIncreasePct: number;
}

export interface CountryDisruptionScenarioRequest {
  scenarioType: "country_disruption";
  targetValue: string;
  severity: SupplierDisruptionSeverity;
}

export interface CommodityShockScenarioRequest {
  scenarioType: "commodity_shock";
  targetValue: string;
  severity: SupplierDisruptionSeverity;
}

export type SimulatorScenarioRequest =
  | SupplierDisruptionScenarioRequest
  | CountryDisruptionScenarioRequest
  | CommodityShockScenarioRequest
  | OperationalDeteriorationScenarioRequest;

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

export interface SimulatorScenarioMeta {
  scenarioType: ScenarioType;
  title: string;
  summary: string;
  supplierId?: number | null;
  supplierName?: string | null;
  country?: string | null;
  severity?: SupplierDisruptionSeverity | null;
  targetType?: OperationalTargetType | null;
  targetValue?: string | null;
  delayIncreasePct?: number | null;
  defectIncreasePct?: number | null;
  costVarianceIncreasePct?: number | null;
}

export interface SimulatorScenarioResponse {
  scenario: SimulatorScenarioMeta;
  before: SimulatorKpiSummary;
  after: SimulatorKpiSummary;
  deltas: SimulatorDeltaSummary;
  riskBandMovement: SimulatorRiskBandMovement[];
  affectedSuppliers: SimulatorAffectedSupplierItem[];
}

export interface SimulatorOptionItem {
  label: string;
  value: string;
}

export interface SimulatorOptionsResponse {
  countries: SimulatorOptionItem[];
  commodities: SimulatorOptionItem[];
}

export async function getSimulatorOptions(): Promise<SimulatorOptionsResponse> {
  return apiRequest<SimulatorOptionsResponse>("/simulator/options");
}

export async function runSimulation(
  payload: SimulatorScenarioRequest,
): Promise<SimulatorScenarioResponse> {
  return apiRequest<SimulatorScenarioResponse>("/simulator/run", {
    method: "POST",
    json: payload,
  });
}
