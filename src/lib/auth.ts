import { SignJWT, jwtVerify } from "jose";

export type Role = "employee" | "manager" | "admin";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET environment variable is required in production");
    }
    return "dev-secret-change-me";
  }
  return secret;
}

function getJwtKey() {
  return new TextEncoder().encode(getJwtSecret());
}

export type AuthUser = {
  id: string;
  role: Role;
};

export async function signAccessToken(payload: AuthUser, rememberMe = false) {
  return new SignJWT({ sub: payload.id, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(rememberMe ? "30d" : "7d")
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
