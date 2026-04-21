import { NextResponse } from "next/server";
import { getBearerToken, verifyAccessToken, AuthUser, Role } from "./auth";

export type AuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; response: NextResponse };

export async function requireUser(req: Request, allowed?: Role[]): Promise<AuthResult> {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  let user: AuthUser;
  try {
    user = await verifyAccessToken(token);
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (allowed && !allowed.includes(user.role)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, user };
}
