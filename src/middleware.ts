import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

function getJwtKey() {
  const secret = process.env.JWT_SECRET ?? "dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

type TokenPayload = { sub: string; role: string };

async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtKey());
    if (!payload.sub || typeof payload.sub !== "string") return null;
    const role = payload.role as string;
    if (!["employee", "manager", "admin"].includes(role)) return null;
    return { sub: payload.sub, role };
  } catch {
    return null;
  }
}

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const [type, token] = authHeader.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

const PROTECTED_PAGE_PREFIXES = ["/admin", "/manager", "/employee", "/sales", "/profile", "/pending"];
const PROTECTED_API_PREFIXES = ["/api/admin", "/api/manager", "/api/sales", "/api/attendance", "/api/leave", "/api/corrections", "/api/me", "/api/pending-summary", "/api/notifications", "/api/qr", "/api/leave-balance"];

const ADMIN_PREFIXES = ["/admin", "/api/admin"];
const MANAGER_PREFIXES = ["/manager", "/api/manager"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip public routes
  if (
    pathname === "/login" ||
    pathname === "/setup" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/setup" ||
    pathname === "/api/org" ||
    pathname === "/api/health" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf)$/)
  ) {
    return NextResponse.next();
  }

  const isProtectedPage = PROTECTED_PAGE_PREFIXES.some((p) => pathname.startsWith(p));
  const isProtectedApi = PROTECTED_API_PREFIXES.some((p) => pathname.startsWith(p));

  if (!isProtectedPage && !isProtectedApi) {
    return NextResponse.next();
  }

  // For API routes, check the Authorization header
  const token = extractBearerToken(req.headers.get("authorization"));

  if (!token) {
    if (isProtectedApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // For pages, redirect to login
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  const payload = await verifyToken(token);
  if (!payload) {
    if (isProtectedApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Role-based access checks
  const isAdminRoute = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
  const isManagerRoute = MANAGER_PREFIXES.some((p) => pathname.startsWith(p));

  if (isAdminRoute && payload.role !== "admin") {
    if (isProtectedApi) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const homeUrl = req.nextUrl.clone();
    homeUrl.pathname = "/employee";
    return NextResponse.redirect(homeUrl);
  }

  if (isManagerRoute && !["admin", "manager"].includes(payload.role)) {
    if (isProtectedApi) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const homeUrl = req.nextUrl.clone();
    homeUrl.pathname = "/employee";
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
