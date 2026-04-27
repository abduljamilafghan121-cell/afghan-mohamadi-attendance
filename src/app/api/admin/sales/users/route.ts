import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";
import { requireUser } from "../../../../../lib/apiAuth";

export async function GET(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      planCycleWeeks: true,
    },
  });
  return NextResponse.json({ users });
}

const PatchSchema = z.object({
  id: z.string().min(1),
  planCycleWeeks: z.number().int().refine((v) => v === 1 || v === 2 || v === 4, {
    message: "planCycleWeeks must be 1, 2, or 4",
  }),
});

export async function PATCH(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const body = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: body.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }

  const { id, planCycleWeeks } = body.data;

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // When the cycle shrinks, drop now-orphaned templates whose weekIndex no
  // longer fits inside the new cycle (their VisitPlan rows already created
  // remain untouched — only future generation is affected).
  await prisma.$transaction(async (tx) => {
    await tx.weeklyPlanTemplate.deleteMany({
      where: { userId: id, weekIndex: { gt: planCycleWeeks } },
    });
    await tx.user.update({
      where: { id },
      data: { planCycleWeeks },
    });
  });

  return NextResponse.json({ ok: true });
}
