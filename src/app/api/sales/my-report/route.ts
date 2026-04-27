import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { requireUser } from "../../../../lib/apiAuth";

function dayBoundsForLocal(dateStr: string | null) {
  // dateStr is YYYY-MM-DD in user-local. We use server local (UTC in container)
  // Construct using the date string at start/end of UTC day.
  const d = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : new Date();
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const dateStr = url.searchParams.get("date");
  const { start, end } = dayBoundsForLocal(dateStr);

  const [visits, orders, payments] = await Promise.all([
    prisma.visit.findMany({
      where: { userId: auth.user.id, visitDate: { gte: start, lt: end } },
      orderBy: { visitDate: "asc" },
      include: {
        shop: { select: { id: true, name: true } },
        products: true,
      },
    }),
    prisma.order.findMany({
      where: { userId: auth.user.id, createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: "asc" },
      include: {
        shop: { select: { id: true, name: true, phone: true } },
        items: true,
      },
    }),
    prisma.payment.findMany({
      where: { userId: auth.user.id, createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: "asc" },
      include: { shop: { select: { id: true, name: true } } },
    }),
  ]);

  const totalVisits = visits.length;
  // Sales totals only count approved + dispatched orders.
  // Pending orders aren't sales yet; rejected orders never count.
  const countedOrders = orders.filter(
    (o) => o.status === "approved" || o.status === "dispatched",
  );
  const totalOrdersValue = Number(countedOrders.reduce((s, o) => s + o.total, 0).toFixed(2));
  const cashOrders = Number(
    countedOrders.filter((o) => o.paymentType === "cash").reduce((s, o) => s + o.total, 0).toFixed(2),
  );
  const creditOrders = Number(
    countedOrders.filter((o) => o.paymentType === "credit").reduce((s, o) => s + o.total, 0).toFixed(2),
  );
  const totalCollections = Number(payments.reduce((s, p) => s + p.amount, 0).toFixed(2));

  // Unique shops visited
  const shopMap = new Map<string, { id: string; name: string }>();
  for (const v of visits) shopMap.set(v.shopId, v.shop);
  const shopsVisited = Array.from(shopMap.values());

  return NextResponse.json({
    date: start.toISOString(),
    summary: {
      totalVisits,
      totalOrdersValue,
      cashOrders,
      creditOrders,
      totalCollections,
      ordersCount: orders.length,
      shopsCount: shopsVisited.length,
    },
    visits,
    orders,
    payments,
    shopsVisited,
  });
}
