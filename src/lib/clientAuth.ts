export type JwtUser = {
  sub: string;
  role: "employee" | "manager" | "admin";
};

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("attendance_token");
}

export function setToken(token: string) {
  window.localStorage.setItem("attendance_token", token);
}

export function clearToken() {
  window.localStorage.removeItem("attendance_token");
}

export function parseJwt(token: string): JwtUser | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (!json?.sub || !json?.role) return null;
    return { sub: String(json.sub), role: json.role };
  } catch {
    return null;
  }
}
