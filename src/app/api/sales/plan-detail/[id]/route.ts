import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { requireUser } from "../../../../../lib/apiAuth";
import { startOfDay, endOfDay } from "../../../../../lib/visitPlans";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(req, ["employee", "manager", "admin"]);
  if (!auth.ok) return auth.response;

  const plan = await prisma.visitPlan.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, name: true } },
      shop: {
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          region: { select: { name: true } },
        },
      },
      visit: {
        include: {
          products: {
            include: { product: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (plan.userId !== auth.user.id && auth.user.role === "employee") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dayStart = startOfDay(new Date(plan.plannedDate));
  const dayEnd = endOfDay(new Date(plan.plannedDate));

  const [orders, payments] = await Promise.all([
    prisma.order.findMany({
      where: {
        userId: plan.userId,
        shopId: plan.shopId,
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { createdAt: "asc" },
      include: { items: true },
    }),
    prisma.payment.findMany({
      where: {
        userId: plan.userId,
        shopId: plan.shopId,
        createdAt: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return NextResponse.json({ plan, orders, payments });
}
