import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { requireUser } from "../../../../lib/apiAuth";
import { cancelPendingPlansForOutstation } from "../../../../lib/visitPlans";
import { notifyUser } from "../../../../lib/notify";

export async function GET(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;

  const rows = await prisma.outstationRequest.findMany({
    where: status ? { status: status as any } : undefined,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      user: { select: { id: true, name: true, email: true } },
      decidedBy: { select: { id: true, name: true } },
    },
    take: 500,
  });

  return NextResponse.json({ rows });
}

const PatchSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  decisionNote: z.string().max(500).optional().nullable(),
});

export async function PATCH(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const body = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const reqRow = await prisma.outstationRequest.findUnique({ where: { id: body.data.id } });
  if (!reqRow) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (reqRow.status !== "pending") {
    return NextResponse.json({ error: "Already decided" }, { status: 400 });
  }

  if (body.data.action === "reject") {
    const updated = await prisma.outstationRequest.update({
      where: { id: reqRow.id },
      data: {
        status: "rejected",
        decidedAt: new Date(),
        decidedById: auth.user.id,
        decisionNote: body.data.decisionNote?.trim() || null,
      },
    });
    await notifyUser({
      userId: reqRow.userId,
      type: "system",
      title: "Outstation request rejected",
      body: `${reqRow.startDate.toISOString().slice(0, 10)} → ${reqRow.endDate.toISOString().slice(0, 10)}${updated.decisionNote ? ` · ${updated.decisionNote}` : ""}`,
      link: "/sales/outstation",
    });
    return NextResponse.json({ row: updated });
  }

  // Approve: create OutstationDay + back-link + cancel pending plans.
  const day = await prisma.outstationDay.create({
    data: {
      userId: reqRow.userId,
      startDate: reqRow.startDate,
      endDate: reqRow.endDate,
      reason: reqRow.reason,
      createdById: auth.user.id,
    },
  });

  const updated = await prisma.outstationRequest.update({
    where: { id: reqRow.id },
    data: {
      status: "approved",
      decidedAt: new Date(),
      decidedById: auth.user.id,
      decisionNote: body.data.decisionNote?.trim() || null,
      outstationDayId: day.id,
    },
  });

  await cancelPendingPlansForOutstation(reqRow.userId, reqRow.startDate, reqRow.endDate);

  await notifyUser({
    userId: reqRow.userId,
    type: "system",
    title: "Outstation request approved",
    body: `${reqRow.startDate.toISOString().slice(0, 10)} → ${reqRow.endDate.toISOString().slice(0, 10)}`,
    link: "/sales/outstation",
  });

  return NextResponse.json({ row: updated, outstationDay: day });
}
