import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { requireUser } from "../../../../lib/apiAuth";

export async function GET(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") || undefined;
  const module = url.searchParams.get("module") || undefined;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "200", 10) || 200, 500);

  const where: any = {};
  if (userId) where.userId = userId;
  if (module) where.module = module;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(`${from}T00:00:00.000Z`);
    if (to) where.createdAt.lte = new Date(`${to}T23:59:59.999Z`);
  }

  const logs = await prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, name: true, role: true, employeeId: true } },
    },
  });

  return NextResponse.json({ logs });
}
