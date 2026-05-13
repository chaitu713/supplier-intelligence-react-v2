const DEFAULT_API_BASE_URL = "http://localhost:8000/api/v1";

export const API_BASE_URL =
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
    ?.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL;

const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const DEV_USER_ID = env?.VITE_DEV_USER_ID;
const DEV_USER_ROLES = env?.VITE_DEV_USER_ROLES;

export class ApiError extends Error {
  readonly status: number;
  readonly payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

const AI_SAFETY_MESSAGE =
  "This request could not be processed because it conflicts with AI safety rules.";

type RequestOptions = RequestInit & {
  json?: unknown;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { json, headers, ...rest } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(DEV_USER_ID ? { "X-User-Id": DEV_USER_ID } : {}),
      ...(DEV_USER_ROLES ? { "X-User-Roles": DEV_USER_ROLES } : {}),
      ...headers,
    },
    body: json ? JSON.stringify(json) : rest.body,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const detail =
      typeof payload === "object" &&
      payload !== null &&
      "detail" in payload &&
      typeof (payload as { detail?: unknown }).detail === "string"
        ? (payload as { detail: string }).detail
        : `Request failed with status ${response.status}`;

    throw new ApiError(detail.includes("AI safety rules") ? AI_SAFETY_MESSAGE : detail, response.status, payload);
  }

  return payload as T;
}
