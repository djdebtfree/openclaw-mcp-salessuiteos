import fetch from "node-fetch";

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export async function apiCall<T = any>(
  baseUrl: string,
  endpoint: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
): Promise<ApiResponse<T>> {
  const { method = "GET", headers = {}, body } = options;
  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data: data as T };
  } catch (err: any) {
    return { ok: false, status: 0, error: err.message };
  }
}
