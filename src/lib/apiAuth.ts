import { NextResponse } from "next/server";
import { getBearerToken, verifyAccessToken, AuthUser, Role } from "./auth";
import { prisma } from "./prisma";

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

  // Verify the user still exists and is active on every request.
  // This ensures deactivated users cannot continue using old tokens.
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isActive: true },
  });
  if (!dbUser || !dbUser.isActive) {
    return { ok: false, response: NextResponse.json({ error: "Account disabled" }, { status: 403 }) };
  }

  if (allowed && !allowed.includes(user.role)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, user };
}
