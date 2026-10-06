export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

export function authHeaders(
  token?: string,
  extra?: { role?: string; id?: string; departmentId?: string },
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (extra?.role) headers["x-user-role"] = extra.role.toLowerCase();
  if (extra?.id) headers["x-user-id"] = extra.id;
  if (extra?.departmentId) headers["x-department-id"] = extra.departmentId;
  return headers;
}

export async function fetchJson<T = any>(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, options);
  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    throw new Error(typeof body === "string" ? body || res.statusText : body.error || res.statusText);
  }
  return body as T;
}
