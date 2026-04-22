import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { requireUser } from "../../../../lib/apiAuth";
import {
  cancelPendingPlansForOutstation,
  startOfDay,
  endOfDay,
} from "../../../../lib/visitPlans";

export async function GET(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") || undefined;
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");

  const where: any = {};
  if (userId) where.userId = userId;
  if (fromStr || toStr) {
    where.AND = [];
    if (toStr) where.AND.push({ startDate: { lte: endOfDay(new Date(toStr + "T00:00:00")) } });
    if (fromStr) where.AND.push({ endDate: { gte: startOfDay(new Date(fromStr + "T00:00:00")) } });
  }

  const rows = await prisma.outstationDay.findMany({
    where,
    orderBy: { startDate: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
    },
    take: 500,
  });

  return NextResponse.json({ rows });
}

const CreateSchema = z.object({
  userId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().max(500).optional().nullable(),
});

export async function POST(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const body = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const start = startOfDay(new Date(body.data.startDate + "T00:00:00"));
  const end = startOfDay(new Date(body.data.endDate + "T00:00:00"));
  if (end < start) {
    return NextResponse.json({ error: "End date must be on or after start date" }, { status: 400 });
  }

  const row = await prisma.outstationDay.create({
    data: {
      userId: body.data.userId,
      startDate: start,
      endDate: end,
      reason: body.data.reason?.trim() || null,
      createdById: auth.user.id,
    },
  });

  // Cancel any pending template plans for this user across the range.
  await cancelPendingPlansForOutstation(body.data.userId, start, end);

  return NextResponse.json({ row });
}

const PatchSchema = z.object({
  id: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  reason: z.string().max(500).optional().nullable(),
});

export async function PATCH(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const body = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const existing = await prisma.outstationDay.findUnique({ where: { id: body.data.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const start = body.data.startDate
    ? startOfDay(new Date(body.data.startDate + "T00:00:00"))
    : existing.startDate;
  const end = body.data.endDate
    ? startOfDay(new Date(body.data.endDate + "T00:00:00"))
    : existing.endDate;
  if (end < start) {
    return NextResponse.json({ error: "End date must be on or after start date" }, { status: 400 });
  }

  const row = await prisma.outstationDay.update({
    where: { id: body.data.id },
    data: {
      startDate: start,
      endDate: end,
      ...(body.data.reason !== undefined ? { reason: body.data.reason?.trim() || null } : {}),
    },
  });

  await cancelPendingPlansForOutstation(existing.userId, start, end);

  return NextResponse.json({ row });
}

export async function DELETE(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.outstationDay.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
