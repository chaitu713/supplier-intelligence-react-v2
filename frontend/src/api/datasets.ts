import { apiRequest } from "./client";

export interface SupplierRecord {
  supplier_id: number;
  supplier_name: string;
  country: string | null;
  category: string | null;
  onboarding_date: string | null;
  certification: string | null;
}

export interface ESGRecord {
  supplier_id: number;
  carbon_emission: number;
  water_usage: number;
  labor_violations: number;
  land_use_risk: string;
  esg_score: number;
}

export interface TransactionRecord {
  transaction_id: number;
  supplier_id: number;
  order_value: number;
  delivery_delay_days: number;
  defect_rate: number;
  cost_variance: number;
}

export type DatasetKey = "suppliers" | "esg" | "transactions";

export type DatasetRecord = SupplierRecord | ESGRecord | TransactionRecord;

export async function getSuppliers(): Promise<SupplierRecord[]> {
  return apiRequest<SupplierRecord[]>("/suppliers");
}

export async function getEsgRecords(): Promise<ESGRecord[]> {
  return apiRequest<ESGRecord[]>("/esg");
}

export async function getTransactions(): Promise<TransactionRecord[]> {
  return apiRequest<TransactionRecord[]>("/transactions");
}
