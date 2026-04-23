import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../../lib/prisma";
import { requireUser } from "../../../../../../lib/apiAuth";
import { notifyUser } from "../../../../../../lib/notify";
import { logActivity } from "../../../../../../lib/activityLog";

const PatchSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewNotes: z.string().max(2000).optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const body = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const existing = await prisma.order.findUnique({
    where: { id: params.id },
    include: { shop: { select: { name: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (existing.status !== "pending") {
    return NextResponse.json(
      { error: `Order already ${existing.status}` },
      { status: 400 },
    );
  }

  const updated = await prisma.order.update({
    where: { id: params.id },
    data: {
      status: body.data.status,
      reviewedById: auth.user.id,
      reviewedAt: new Date(),
      reviewNotes: body.data.reviewNotes ?? null,
    },
    include: {
      user: { select: { id: true, name: true } },
      shop: { select: { id: true, name: true } },
      items: true,
      reviewedBy: { select: { id: true, name: true } },
    },
  });

  const reviewer = await prisma.user
    .findUnique({ where: { id: auth.user.id }, select: { name: true } })
    .catch(() => null);
  await notifyUser({
    userId: updated.userId,
    type: "order_decided",
    title: `Order ${body.data.status}`,
    body: `Your order for ${existing.shop.name} (total ${updated.total.toFixed(2)}) was ${body.data.status} by ${reviewer?.name ?? "an admin"}.`,
    link: "/sales",
  }).catch(() => null);

  logActivity(
    auth.user.id,
    `order_${body.data.status}`,
    "admin",
    `Order for ${existing.shop.name} by ${updated.user.name} · total ${updated.total.toFixed(2)}${body.data.reviewNotes ? ` · ${body.data.reviewNotes}` : ""}`,
  ).catch(() => null);

  return NextResponse.json({ order: updated });
}

const PutSchema = z.object({
  paymentType: z.enum(["cash", "credit"]).optional(),
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

export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const body = PutSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    const msg = body.error.issues[0]?.message ?? "Invalid body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const existing = await prisma.order.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (existing.status !== "pending") {
    return NextResponse.json(
      { error: `Only pending orders can be edited` },
      { status: 400 },
    );
  }

  const productIds = body.data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });
  if (products.length !== new Set(productIds).size) {
    return NextResponse.json(
      { error: "One or more products not found" },
      { status: 400 },
    );
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
  const total = Number(
    itemsData.reduce((s, i) => s + i.lineTotal, 0).toFixed(2),
  );

  const updated = await prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({ where: { orderId: params.id } });
    return tx.order.update({
      where: { id: params.id },
      data: {
        total,
        paymentType: body.data.paymentType ?? existing.paymentType,
        notes: body.data.notes ?? null,
        items: { create: itemsData },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        shop: { select: { id: true, name: true } },
        items: true,
        reviewedBy: { select: { id: true, name: true } },
      },
    });
  });

  const editor = await prisma.user
    .findUnique({ where: { id: auth.user.id }, select: { name: true } })
    .catch(() => null);
  await notifyUser({
    userId: updated.userId,
    type: "order_submitted",
    title: "Your pending order was edited by admin",
    body: `${editor?.name ?? "An admin"} updated your order for ${updated.shop.name}. New total: ${updated.total.toFixed(2)}. It is still awaiting approval.`,
    link: "/sales",
  }).catch(() => null);

  return NextResponse.json({ order: updated });
}

