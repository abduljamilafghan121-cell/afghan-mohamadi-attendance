import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { requireUser } from "../../../../lib/apiAuth";
import {
  ensurePlansForDate,
  endOfDay,
  markPastPlansMissed,
  parseDateParam,
} from "../../../../lib/visitPlans";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const date = parseDateParam(url.searchParams.get("date"));

  // Generate today's plans on demand and mark past missed (idempotent).
  if (date <= new Date()) {
    await ensurePlansForDate(date, auth.user.id);
  }
  await markPastPlansMissed();

  const plans = await prisma.visitPlan.findMany({
    where: {
      userId: auth.user.id,
      plannedDate: { gte: date, lte: endOfDay(date) },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: {
      shop: {
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          region: { select: { name: true } },
        },
      },
      visit: { select: { id: true, visitDate: true } },
    },
  });

  const summary = {
    total: plans.length,
    pending: plans.filter((p) => p.status === "pending").length,
    done: plans.filter((p) => p.status === "done").length,
    missed: plans.filter((p) => p.status === "missed").length,
    cancelled: plans.filter((p) => p.status === "cancelled").length,
  };

  return NextResponse.json({ plans, summary });
}
