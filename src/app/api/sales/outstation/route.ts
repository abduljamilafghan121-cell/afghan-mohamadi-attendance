import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { requireUser } from "../../../../lib/apiAuth";
import { startOfDay } from "../../../../lib/visitPlans";
import { notifyAdmins } from "../../../../lib/notify";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const rows = await prisma.outstationRequest.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "desc" },
    include: { decidedBy: { select: { id: true, name: true } } },
    take: 100,
  });
  return NextResponse.json({ rows });
}

const CreateSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().max(500).optional().nullable(),
});

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const body = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const start = startOfDay(new Date(body.data.startDate + "T00:00:00"));
  const end = startOfDay(new Date(body.data.endDate + "T00:00:00"));
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
  }
  if (end < start) {
    return NextResponse.json({ error: "End date must be on or after start date" }, { status: 400 });
  }

  const row = await prisma.outstationRequest.create({
    data: {
      userId: auth.user.id,
      startDate: start,
      endDate: end,
      reason: body.data.reason?.trim() || null,
    },
  });

  const me = await prisma.user.findUnique({ where: { id: auth.user.id }, select: { name: true } });
  const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  await notifyAdmins({
    type: "system",
    title: `Outstation request from ${me?.name ?? "an employee"}`,
    body: `${days} day${days === 1 ? "" : "s"} · ${body.data.startDate} → ${body.data.endDate}${body.data.reason ? ` · "${body.data.reason}"` : ""}`,
    link: "/admin/outstation",
  });

  return NextResponse.json({ row });
}

export async function DELETE(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Salesman can only cancel their own pending requests.
  const row = await prisma.outstationRequest.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.userId !== auth.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (row.status !== "pending") {
    return NextResponse.json({ error: "Only pending requests can be cancelled" }, { status: 400 });
  }

  await prisma.outstationRequest.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
