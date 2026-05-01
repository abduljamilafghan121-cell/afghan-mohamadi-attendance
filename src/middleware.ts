import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protect admin and manager API routes at the edge — fast-fail if no bearer
// token is present at all, before the request reaches the route handler.
// Note: page-level protection (e.g. /admin/*) cannot be done here because
// the JWT is stored in localStorage (not cookies), so it is not accessible
// in middleware. Page routes rely on client-side token checks + redirects.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtectedApi =
    pathname.startsWith("/api/admin/") ||
    pathname.startsWith("/api/manager/") ||
    pathname.startsWith("/api/sales/") ||
    pathname.startsWith("/api/attendance/") ||
    pathname.startsWith("/api/notifications") ||
    pathname.startsWith("/api/offices") ||
    pathname.startsWith("/api/profile");

  if (isProtectedApi) {
    const auth = req.headers.get("authorization");
    if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/admin/:path*",
    "/api/manager/:path*",
    "/api/sales/:path*",
    "/api/attendance/:path*",
    "/api/notifications/:path*",
    "/api/offices/:path*",
    "/api/profile/:path*",
  ],
};
