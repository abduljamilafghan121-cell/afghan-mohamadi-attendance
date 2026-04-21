import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { requireUser } from "../../../../../../lib/apiAuth";

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const shopId = params.id;
  if (!shopId) {
    return NextResponse.json({ error: "Customer id required" }, { status: 400 });
  }

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "mine";
  const limitMine = scope !== "all" || auth.user.role !== "admin";
  const userFilter = limitMine ? { userId: auth.user.id } : {};

  const customer = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { id: true, name: true, address: true, phone: true, gpsLat: true, gpsLng: true, createdAt: true },
  });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const [visits, orders, payments] = await Promise.all([
    prisma.visit.findMany({
      where: { shopId, ...userFilter },
      orderBy: { visitDate: "desc" },
      take: 200,
      include: {
        user: { select: { id: true, name: true } },
        products: true,
      },
    }),
    prisma.order.findMany({
      where: { shopId, ...userFilter },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: { select: { id: true, name: true } },
        items: true,
      },
    }),
    prisma.payment.findMany({
      where: { shopId, ...userFilter },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: { select: { id: true, name: true } },
      },
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
  // Outstanding = credit sales not yet collected (simple approximation:
  // credit total minus all collections from this customer).
  const outstanding = Number((creditSales - totalCollections).toFixed(2));

  const lastVisit = visits[0]?.visitDate ?? null;
  const lastOrder = orders[0]?.createdAt ?? null;
  const lastPayment = payments[0]?.createdAt ?? null;

  type TimelineEntry =
    | { kind: "visit"; at: string; data: typeof visits[number] }
    | { kind: "order"; at: string; data: typeof orders[number] }
    | { kind: "payment"; at: string; data: typeof payments[number] };

  const timeline: TimelineEntry[] = [
    ...visits.map((v) => ({ kind: "visit" as const, at: v.visitDate.toISOString(), data: v })),
    ...orders.map((o) => ({ kind: "order" as const, at: o.createdAt.toISOString(), data: o })),
    ...payments.map((p) => ({ kind: "payment" as const, at: p.createdAt.toISOString(), data: p })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  return NextResponse.json({
    customer,
    summary: {
      visitsCount: visits.length,
      ordersCount: orders.length,
      paymentsCount: payments.length,
      totalSales,
      cashSales,
      creditSales,
      totalCollections,
      outstanding,
      lastVisit,
      lastOrder,
      lastPayment,
    },
    timeline,
    scope: limitMine ? "mine" : "all",
  });
}
