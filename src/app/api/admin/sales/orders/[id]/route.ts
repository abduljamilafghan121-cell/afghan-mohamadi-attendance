import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../../lib/prisma";
import { requireUser } from "../../../../../../lib/apiAuth";
import { notifyUser } from "../../../../../../lib/notify";

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

  return NextResponse.json({ order: updated });
}
