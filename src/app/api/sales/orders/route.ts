import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { requireUser } from "../../../../lib/apiAuth";
import { notifyAdmins } from "../../../../lib/notify";
import { logActivity } from "../../../../lib/activityLog";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200);

  const orders = await prisma.order.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      shop: { select: { id: true, name: true } },
      items: true,
    },
  });

  return NextResponse.json({ orders });
}

const CreateSchema = z.object({
  shopId: z.string().min(1, "Customer is required"),
  paymentType: z.enum(["cash", "credit"]).default("cash"),
  notes: z.string().max(2000).optional().nullable(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1, "At least one item is required"),
});

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const body = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    const msg = body.error.issues[0]?.message ?? "Invalid body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const shop = await prisma.shop.findUnique({ where: { id: body.data.shopId } });
  if (!shop) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const productIds = body.data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  if (products.length !== productIds.length) {
    return NextResponse.json({ error: "One or more products not found" }, { status: 400 });
  }
  const productMap = new Map(products.map((p) => [p.id, p]));

  const itemsData = body.data.items.map((it) => {
    const p = productMap.get(it.productId)!;
    const lineTotal = Number((p.price * it.quantity).toFixed(2));
    return {
      productId: p.id,
      productName: p.name,
      unitPrice: p.price,
      quantity: it.quantity,
      lineTotal,
    };
  });
  const total = Number(itemsData.reduce((s, i) => s + i.lineTotal, 0).toFixed(2));

  const order = await prisma.order.create({
    data: {
      userId: auth.user.id,
      shopId: shop.id,
      total,
      paymentType: body.data.paymentType,
      notes: body.data.notes ?? null,
      status: "pending",
      items: { create: itemsData },
    },
    include: { items: true, shop: { select: { id: true, name: true } } },
  });

  // Notify admins that a new order is awaiting approval.
  const submitter = await prisma.user
    .findUnique({ where: { id: auth.user.id }, select: { name: true } })
    .catch(() => null);
  await notifyAdmins({
    type: "order_submitted",
    title: "New order pending approval",
    body: `${submitter?.name ?? "A salesman"} placed an order for ${shop.name} — total ${total.toFixed(2)}`,
    link: "/admin/sales/orders",
  }).catch(() => null);

  logActivity(
    auth.user.id,
    "order_created",
    "sales",
    `Order for ${shop.name} · ${body.data.paymentType} · total ${total.toFixed(2)}`,
  ).catch(() => null);

  return NextResponse.json({ order });
}
