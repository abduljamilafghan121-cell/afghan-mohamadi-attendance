import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { requireUser } from "../../../../lib/apiAuth";
import { linkVisitToPlan } from "../../../../lib/visitPlans";
import { logActivity } from "../../../../lib/activityLog";
import { checkCanWorkToday } from "../../../../lib/workdayGuard";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200);

  const visits = await prisma.visit.findMany({
    where: { userId: auth.user.id },
    orderBy: { visitDate: "desc" },
    take: limit,
    include: {
      shop: { select: { id: true, name: true } },
      products: true,
    },
  });

  return NextResponse.json({ visits });
}

const CreateSchema = z.object({
  shopId: z.string().min(1),
  customerType: z.enum(["new_customer", "existing"]).default("existing"),
  notes: z.string().max(2000).optional().nullable(),
  gpsLat: z.number().min(-90).max(90).optional().nullable(),
  gpsLng: z.number().min(-180).max(180).optional().nullable(),
  products: z
    .array(
      z.object({
        productId: z.string().min(1),
        offeredPrice: z.number().nonnegative().optional().nullable(),
        discussion: z.string().max(1000).optional().nullable(),
        interest: z.string().max(200).optional().nullable(),
      }),
    )
    .optional()
    .default([]),
});

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const guard = await checkCanWorkToday(auth.user.id, auth.user.role);
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const body = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const shop = await prisma.shop.findUnique({ where: { id: body.data.shopId } });
  if (!shop) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  let visitProductsData: { productId: string; productName: string; offeredPrice: number | null; discussion: string | null; interest: string | null }[] = [];
  if (body.data.products && body.data.products.length > 0) {
    const ids = Array.from(new Set(body.data.products.map((p) => p.productId)));
    const products = await prisma.product.findMany({ where: { id: { in: ids } } });
    if (products.length !== ids.length) {
      return NextResponse.json({ error: "One or more products not found" }, { status: 400 });
    }
    const map = new Map(products.map((p) => [p.id, p]));
    visitProductsData = body.data.products.map((vp) => {
      const p = map.get(vp.productId)!;
      // If salesman left "Offered price" blank, default to the product's
      // standard price. If they entered a value, store it as the offered price.
      const offeredPrice =
        vp.offeredPrice === null || vp.offeredPrice === undefined
          ? p.price
          : vp.offeredPrice;
      return {
        productId: p.id,
        productName: p.name,
        offeredPrice,
        discussion: vp.discussion ?? null,
        interest: vp.interest ?? null,
      };
    });
  }

  const visit = await prisma.visit.create({
    data: {
      userId: auth.user.id,
      shopId: shop.id,
      customerType: body.data.customerType,
      notes: body.data.notes ?? null,
      gpsLat: body.data.gpsLat ?? null,
      gpsLng: body.data.gpsLng ?? null,
      products: visitProductsData.length ? { create: visitProductsData } : undefined,
    },
    include: {
      shop: { select: { id: true, name: true } },
      products: true,
    },
  });

  // Auto-link to a matching pending plan (today + same customer)
  await linkVisitToPlan(visit.id, auth.user.id, shop.id).catch(() => null);

  logActivity(
    auth.user.id,
    "visit_logged",
    "sales",
    `Visited ${shop.name}${body.data.products.length ? ` · ${body.data.products.length} product(s) discussed` : ""}${guard.isOvertime ? " · overtime" : ""}`,
  ).catch(() => null);

  return NextResponse.json({ visit });
}
