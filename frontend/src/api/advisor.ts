import { apiRequest } from "./client";

export interface AdvisorMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  source?: string | null;
  provider?: string | null;
  model?: string | null;
  trace_id?: string | null;
}

export type AdvisorLens =
  | "general"
  | "executive"
  | "analytics"
  | "simulator"
  | "due_diligence"
  | "esg_monitoring";

export interface AdvisorSimulatorContext {
  scenarioTitle: string;
  scenarioSummary: string;
  highRiskDelta: number;
  overallRiskDelta: number;
  operationalRiskDelta: number;
  esgRiskDelta: number;
  affectedSupplierCount: number;
}

export interface AdvisorSession {
  sessionId: string;
  createdAt: string;
  messages: AdvisorMessage[];
}

export interface AdvisorMessageResponse {
  sessionId: string;
  reply: AdvisorMessage;
  lensUsed: AdvisorLens;
}

export interface SendAdvisorMessagePayload {
  message: string;
  lens?: AdvisorLens;
  simulatorContext?: AdvisorSimulatorContext | null;
}

export async function createAdvisorSession(): Promise<AdvisorSession> {
  return apiRequest<AdvisorSession>("/advisor/sessions", {
    method: "POST",
  });
}

export async function getAdvisorSession(sessionId: string): Promise<AdvisorSession> {
  return apiRequest<AdvisorSession>(`/advisor/sessions/${sessionId}`);
}

export async function deleteAdvisorSession(sessionId: string): Promise<void> {
  await apiRequest(`/advisor/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

export async function sendAdvisorMessage(
  sessionId: string,
  payload: SendAdvisorMessagePayload,
): Promise<AdvisorMessageResponse> {
  return apiRequest<AdvisorMessageResponse>(`/advisor/sessions/${sessionId}/messages`, {
    method: "POST",
    json: payload,
  });
}
