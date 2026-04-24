import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";
import { requireUser } from "../../../../../lib/apiAuth";
import {
  ensurePlansForDate,
  endOfDay,
  markPastPlansMissed,
  parseDateParam,
  startOfDay,
} from "../../../../../lib/visitPlans";
import { checkCanWorkOnDate } from "../../../../../lib/workdayGuard";

export async function GET(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const userId = url.searchParams.get("userId");
  const status = url.searchParams.get("status") as
    | "pending"
    | "done"
    | "missed"
    | "cancelled"
    | null;

  const fromDate = from ? parseDateParam(from) : startOfDay(new Date());
  const toDate = to ? endOfDay(parseDateParam(to)) : endOfDay(fromDate);

  // Auto-generate any missing template plans in this window
  // Cap to a reasonable window
  const dayMs = 86400000;
  const span = Math.min(31, Math.floor((toDate.getTime() - fromDate.getTime()) / dayMs) + 1);
  for (let i = 0; i < span; i++) {
    const d = new Date(fromDate.getTime() + i * dayMs);
    if (d <= new Date()) await ensurePlansForDate(d, userId ?? null);
  }
  await markPastPlansMissed();

  const plans = await prisma.visitPlan.findMany({
    where: {
      plannedDate: { gte: fromDate, lte: toDate },
      ...(userId ? { userId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: [{ plannedDate: "asc" }, { createdAt: "asc" }],
    include: {
      user: { select: { id: true, name: true } },
      shop: { select: { id: true, name: true, address: true, region: { select: { name: true } } } },
      visit: { select: { id: true, visitDate: true } },
    },
  });

  return NextResponse.json({ plans });
}

const CreateSchema = z.object({
  userId: z.string().min(1),
  shopId: z.string().min(1),
  plannedDate: z.string().min(1),
  notes: z.string().max(2000).optional().nullable(),
});

export async function POST(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const body = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const date = parseDateParam(body.data.plannedDate);

  const guard = await checkCanWorkOnDate(body.data.userId, date);
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const plan = await prisma.visitPlan.create({
    data: {
      userId: body.data.userId,
      shopId: body.data.shopId,
      plannedDate: date,
      notes: body.data.notes ?? null,
      status: "pending",
      source: "manual",
      createdById: auth.user.id,
    },
    include: {
      user: { select: { id: true, name: true } },
      shop: { select: { id: true, name: true, address: true } },
    },
  });
  return NextResponse.json({ plan });
}

const PatchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["pending", "done", "missed", "cancelled"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
  plannedDate: z.string().optional(),
  shopId: z.string().optional(),
  userId: z.string().optional(),
});

export async function PATCH(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const body = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: any = {};
  if (body.data.status !== undefined) data.status = body.data.status;
  if (body.data.notes !== undefined) data.notes = body.data.notes;
  if (body.data.plannedDate !== undefined) data.plannedDate = parseDateParam(body.data.plannedDate);
  if (body.data.shopId !== undefined) data.shopId = body.data.shopId;
  if (body.data.userId !== undefined) data.userId = body.data.userId;

  // If we're moving the plan to a new date and/or a new salesman, re-validate
  // that the target user can be scheduled to work on the target date.
  if (data.plannedDate !== undefined || data.userId !== undefined) {
    const existing = await prisma.visitPlan.findUnique({
      where: { id: body.data.id },
      select: { userId: true, plannedDate: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    const targetUserId = data.userId ?? existing.userId;
    const targetDate = data.plannedDate ?? existing.plannedDate;
    const guard = await checkCanWorkOnDate(targetUserId, targetDate);
    if (!guard.allowed) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }
  }

  const plan = await prisma.visitPlan.update({
    where: { id: body.data.id },
    data,
  });
  return NextResponse.json({ plan });
}

export async function DELETE(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.visitPlan.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
