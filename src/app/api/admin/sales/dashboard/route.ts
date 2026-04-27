import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { requireUser } from "../../../../../lib/apiAuth";

export async function GET(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const dateStr = url.searchParams.get("date");
  const d = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : new Date();
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const [orders, payments, visits, users] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        status: { in: ["approved", "dispatched"] },
      },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.payment.findMany({
      where: { createdAt: { gte: start, lt: end } },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.visit.findMany({
      where: { visitDate: { gte: start, lt: end } },
      select: { userId: true, shopId: true },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    }),
  ]);

  const totalSales = Number(orders.reduce((s, o) => s + o.total, 0).toFixed(2));
  const cashSales = Number(
    orders.filter((o) => o.paymentType === "cash").reduce((s, o) => s + o.total, 0).toFixed(2),
  );
  const creditSales = Number(
    orders.filter((o) => o.paymentType === "credit").reduce((s, o) => s + o.total, 0).toFixed(2),
  );
  const totalCollections = Number(payments.reduce((s, p) => s + p.amount, 0).toFixed(2));

  // Aggregate per user
  const perUser = new Map<
    string,
    { id: string; name: string; sales: number; collections: number; visits: number; orders: number }
  >();
  for (const u of users) {
    perUser.set(u.id, { id: u.id, name: u.name, sales: 0, collections: 0, visits: 0, orders: 0 });
  }
  for (const o of orders) {
    const row =
      perUser.get(o.userId) ??
      { id: o.userId, name: o.user?.name ?? "Unknown", sales: 0, collections: 0, visits: 0, orders: 0 };
    row.sales = Number((row.sales + o.total).toFixed(2));
    row.orders += 1;
    perUser.set(o.userId, row);
  }
  for (const p of payments) {
    const row =
      perUser.get(p.userId) ??
      { id: p.userId, name: p.user?.name ?? "Unknown", sales: 0, collections: 0, visits: 0, orders: 0 };
    row.collections = Number((row.collections + p.amount).toFixed(2));
    perUser.set(p.userId, row);
  }
  for (const v of visits) {
    const row =
      perUser.get(v.userId) ??
      { id: v.userId, name: "Unknown", sales: 0, collections: 0, visits: 0, orders: 0 };
    row.visits += 1;
    perUser.set(v.userId, row);
  }

  const perEmployee = Array.from(perUser.values()).sort((a, b) => b.sales - a.sales);
  const topPerformers = perEmployee.filter((r) => r.sales > 0).slice(0, 5);

  return NextResponse.json({
    date: start.toISOString(),
    summary: {
      totalSales,
      cashSales,
      creditSales,
      totalCollections,
      ordersCount: orders.length,
      visitsCount: visits.length,
    },
    perEmployee,
    topPerformers,
  });
}
