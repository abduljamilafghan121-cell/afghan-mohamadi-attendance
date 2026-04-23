import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { requireUser } from "../../../../../lib/apiAuth";

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  if (isNaN(d.getTime())) return null;
  return d;
}

export async function GET(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const from = parseDate(url.searchParams.get("from"));
  const to = parseDate(url.searchParams.get("to"));
  const userId = url.searchParams.get("userId") || undefined;

  const start = from ?? new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const end = to ? new Date(to.getTime() + 24 * 60 * 60 * 1000) : new Date();

  const ordersWhere: any = { createdAt: { gte: start, lt: end }, status: "approved" };
  if (userId) ordersWhere.userId = userId;

  const paymentsWhere: any = { createdAt: { gte: start, lt: end } };
  if (userId) paymentsWhere.userId = userId;

  const visitsWhere: any = { visitDate: { gte: start, lt: end } };
  if (userId) visitsWhere.userId = userId;

  const [orders, payments, visits] = await Promise.all([
    prisma.order.findMany({
      where: ordersWhere,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true } },
        shop: { select: { id: true, name: true } },
        items: true,
      },
    }),
    prisma.payment.findMany({
      where: paymentsWhere,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true } },
        shop: { select: { id: true, name: true } },
      },
    }),
    prisma.visit.findMany({
      where: visitsWhere,
      orderBy: { visitDate: "desc" },
      include: {
        user: { select: { id: true, name: true } },
        shop: { select: { id: true, name: true } },
        products: true,
      },
    }),
  ]);

  const summary = {
    totalSales: Number(orders.reduce((s, o) => s + o.total, 0).toFixed(2)),
    cashSales: Number(
      orders.filter((o) => o.paymentType === "cash").reduce((s, o) => s + o.total, 0).toFixed(2),
    ),
    creditSales: Number(
      orders.filter((o) => o.paymentType === "credit").reduce((s, o) => s + o.total, 0).toFixed(2),
    ),
    totalCollections: Number(payments.reduce((s, p) => s + p.amount, 0).toFixed(2)),
    ordersCount: orders.length,
    visitsCount: visits.length,
    paymentsCount: payments.length,
  };

  return NextResponse.json({
    from: start.toISOString(),
    to: end.toISOString(),
    summary,
    orders,
    payments,
    visits,
  });
}
