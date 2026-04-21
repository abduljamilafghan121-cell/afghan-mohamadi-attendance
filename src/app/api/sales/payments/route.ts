import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { requireUser } from "../../../../lib/apiAuth";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200);

  const payments = await prisma.payment.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { shop: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ payments });
}

const CreateSchema = z.object({
  customerName: z.string().min(1).max(200),
  amount: z.number().positive(),
  method: z.enum(["cash", "bank_transfer", "cheque", "other"]).default("cash"),
  notes: z.string().max(2000).optional().nullable(),
  shopId: z.string().optional().nullable(),
  orderId: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const body = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const payment = await prisma.payment.create({
    data: {
      userId: auth.user.id,
      customerName: body.data.customerName.trim(),
      amount: body.data.amount,
      method: body.data.method,
      notes: body.data.notes ?? null,
      shopId: body.data.shopId || null,
      orderId: body.data.orderId || null,
    },
    include: { shop: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ payment });
}
