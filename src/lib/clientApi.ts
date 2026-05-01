import { getToken } from "./clientAuth";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });

  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    // Response had no JSON body (e.g. 204 No Content or plain text error)
  }

  if (!res.ok) {
    const message: string =
      (data && (data.error || data.message) && String(data.error || data.message)) ||
      `Request failed (HTTP ${res.status})`;
    const err = new Error(message) as Error & { status: number };
    err.status = res.status;
    throw err;
  }

  return data as T;
}
