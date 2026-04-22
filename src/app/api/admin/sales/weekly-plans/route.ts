import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";
import { requireUser } from "../../../../../lib/apiAuth";
import { syncTodayFromTemplate } from "../../../../../lib/visitPlans";

export async function GET(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");

  const templates = await prisma.weeklyPlanTemplate.findMany({
    where: { ...(userId ? { userId } : {}) },
    orderBy: [{ userId: "asc" }, { weekday: "asc" }],
    include: {
      user: { select: { id: true, name: true } },
      region: { select: { id: true, name: true } },
      customers: {
        include: { shop: { select: { id: true, name: true } } },
      },
    },
  });

  return NextResponse.json({ templates });
}

const UpsertSchema = z.object({
  userId: z.string().min(1),
  weekday: z.number().int().min(0).max(6),
  regionId: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
  shopIds: z.array(z.string().min(1)).default([]),
});

export async function POST(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const body = UpsertSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { userId, weekday, regionId, notes, isActive, shopIds } = body.data;

  // Verify user
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Verify shops
  if (shopIds.length > 0) {
    const found = await prisma.shop.findMany({
      where: { id: { in: shopIds }, isActive: true },
      select: { id: true },
    });
    if (found.length !== new Set(shopIds).size) {
      return NextResponse.json({ error: "One or more customers not found" }, { status: 400 });
    }
  }

  // Upsert template + replace customer set
  const template = await prisma.$transaction(async (tx) => {
    const tpl = await tx.weeklyPlanTemplate.upsert({
      where: { userId_weekday: { userId, weekday } },
      update: {
        regionId: regionId ?? null,
        notes: notes ?? null,
        ...(isActive !== undefined ? { isActive } : {}),
      },
      create: {
        userId,
        weekday,
        regionId: regionId ?? null,
        notes: notes ?? null,
        isActive: isActive ?? true,
        createdById: auth.user.id,
      },
    });

    await tx.weeklyPlanCustomer.deleteMany({ where: { templateId: tpl.id } });
    if (shopIds.length > 0) {
      const unique = Array.from(new Set(shopIds));
      await tx.weeklyPlanCustomer.createMany({
        data: unique.map((shopId) => ({ templateId: tpl.id, shopId })),
        skipDuplicates: true,
      });
    }
    return tpl;
  });

  // Cascade to today's plan if weekday matches today
  await syncTodayFromTemplate(template.id);

  const full = await prisma.weeklyPlanTemplate.findUnique({
    where: { id: template.id },
    include: {
      user: { select: { id: true, name: true } },
      region: { select: { id: true, name: true } },
      customers: { include: { shop: { select: { id: true, name: true } } } },
    },
  });

  return NextResponse.json({ template: full });
}

export async function DELETE(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.weeklyPlanTemplate.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
