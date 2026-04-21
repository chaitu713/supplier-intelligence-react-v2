import { apiRequest } from "./client";

export interface AdvisorMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface AdvisorSession {
  sessionId: string;
  createdAt: string;
  messages: AdvisorMessage[];
}

export interface AdvisorMessageResponse {
  sessionId: string;
  reply: AdvisorMessage;
}

export async function createAdvisorSession(): Promise<AdvisorSession> {
  return apiRequest<AdvisorSession>("/advisor/sessions", {
    method: "POST",
  });
}

export async function getAdvisorSession(sessionId: string): Promise<AdvisorSession> {
  return apiRequest<AdvisorSession>(`/advisor/sessions/${sessionId}`);
}

export async function sendAdvisorMessage(
  sessionId: string,
  message: string,
): Promise<AdvisorMessageResponse> {
  return apiRequest<AdvisorMessageResponse>(`/advisor/sessions/${sessionId}/messages`, {
    method: "POST",
    json: { message },
  });
}
