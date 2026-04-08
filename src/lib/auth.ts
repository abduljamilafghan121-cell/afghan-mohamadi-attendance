import { SignJWT, jwtVerify } from "jose";

export type Role = "employee" | "manager" | "admin";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

function getJwtKey() {
  return new TextEncoder().encode(JWT_SECRET);
}

export type AuthUser = {
  id: string;
  role: Role;
};

export async function signAccessToken(payload: AuthUser) {
  return new SignJWT({ sub: payload.id, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtKey());
}

export async function verifyAccessToken(token: string): Promise<AuthUser> {
  const { payload } = await jwtVerify(token, getJwtKey());
  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("Invalid token subject");
  }
  const role = payload.role;
  if (role !== "employee" && role !== "manager" && role !== "admin") {
    throw new Error("Invalid token role");
  }
  return { id: payload.sub, role };
}

export function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader) return null;
  const [type, token] = authorizationHeader.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export function assertRole(user: AuthUser, allowed: Role[]) {
  if (!allowed.includes(user.role)) throw new Error("Forbidden");
}
