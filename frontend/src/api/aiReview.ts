import { apiRequest } from "./client";

export interface AiReviewItem {
  id: string;
  feature: string;
  reason: string;
  prompt_hash: string;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  reviewer_id: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export async function getAiReviewQueue(status = "pending"): Promise<AiReviewItem[]> {
  return apiRequest<AiReviewItem[]>(`/ai-review/queue?status=${encodeURIComponent(status)}`);
}

export async function resolveAiReviewItem(
  itemId: string,
  decision: "approved" | "rejected",
): Promise<AiReviewItem> {
  return apiRequest<AiReviewItem>(`/ai-review/queue/${itemId}`, {
    method: "POST",
    json: { decision },
  });
}
