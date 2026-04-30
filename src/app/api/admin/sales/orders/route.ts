import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { requireUser } from "../../../../../lib/apiAuth";

export async function GET(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "pending";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "50", 10) || 50), 200);

  const where: any = {};
  if (
    status === "pending" ||
    status === "approved" ||
    status === "rejected" ||
    status === "dispatched"
  ) {
    where.status = status;
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, name: true, email: true } },
        shop: { select: { id: true, name: true, phone: true } },
        items: true,
        reviewedBy: { select: { id: true, name: true } },
        dispatchedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return NextResponse.json({ orders, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}
