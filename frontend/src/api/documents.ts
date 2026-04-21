import { API_BASE_URL, apiRequest } from "./client";

export type DocumentKind = "supplier" | "esg" | "transaction";
export type IngestionStatus = "queued" | "processing" | "completed" | "failed";
export type IngestionStepStatus = "pending" | "processing" | "completed" | "failed";

export interface UploadUrlRequest {
  fileName: string;
  documentKind: DocumentKind;
  contentType: string;
}

export interface UploadUrlResponse {
  fileName: string;
  documentKind: DocumentKind;
  blobKey: string;
  uploadUrl: string;
  uploadMethod: "PUT" | "POST";
  headers?: Record<string, string>;
}

export interface IngestionCreateFile {
  fileName: string;
  documentKind: DocumentKind;
  blobKey: string;
}

export interface IngestionCreateRequest {
  files: IngestionCreateFile[];
}

export interface IngestionStep {
  name: "upload" | "extract" | "parse" | "persist" | "history";
  status: IngestionStepStatus;
  message?: string;
}

export interface IngestionSummary {
  supplierRecordsAdded: number;
  esgRecordsAdded: number;
  transactionRecordsAdded: number;
}

export interface IngestionJob {
  jobId: string;
  status: IngestionStatus;
  createdAt: string;
  updatedAt: string;
  steps: IngestionStep[];
  summary?: IngestionSummary;
}

export interface DocumentHistoryItem {
  documentName: string;
  documentType: string;
  status: string;
  recordsAdded: string;
  timestamp: string;
}

export async function getUploadUrl(payload: UploadUrlRequest): Promise<UploadUrlResponse> {
  return apiRequest<UploadUrlResponse>("/documents/upload-url", {
    method: "POST",
    json: payload,
  });
}

export async function uploadDocumentToStorage(
  file: File,
  uploadConfig: UploadUrlResponse,
): Promise<void> {
  const uploadUrl = new URL(uploadConfig.uploadUrl, `${API_BASE_URL}/`).toString();

  const response = await fetch(uploadUrl, {
    method: uploadConfig.uploadMethod,
    headers: {
      "Content-Type": file.type || "application/pdf",
      ...(uploadConfig.headers ?? {}),
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Upload failed for ${file.name}`);
  }
}

export async function createIngestionJob(
  payload: IngestionCreateRequest,
): Promise<IngestionJob> {
  return apiRequest<IngestionJob>("/documents/ingestions", {
    method: "POST",
    json: payload,
  });
}

export async function getIngestionJob(jobId: string): Promise<IngestionJob> {
  return apiRequest<IngestionJob>(`/documents/ingestions/${jobId}`);
}

export async function getDocumentHistory(): Promise<DocumentHistoryItem[]> {
  return apiRequest<DocumentHistoryItem[]>("/documents/history");
}
