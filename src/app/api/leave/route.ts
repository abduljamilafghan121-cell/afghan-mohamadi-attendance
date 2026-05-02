import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";
import { getBearerToken, verifyAccessToken } from "../../../lib/auth";
import { startOfDayFromDateString } from "../../../lib/qr";
import { notifyAdmins } from "../../../lib/notify";
import { logActivity } from "../../../lib/activityLog";

const CreateSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().optional(),
  leaveType: z.enum(["annual", "sick", "casual", "unpaid"]).optional(),
});

export async function GET(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let authUser;
  try {
    authUser = await verifyAccessToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leaves = await prisma.leaveRequest.findMany({
    where: { userId: authUser.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      reason: true,
      status: true,
      leaveType: true,
      decidedAt: true,
      decidedById: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ leaves });
}

export async function POST(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let authUser;
  try {
    authUser = await verifyAccessToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const start = startOfDayFromDateString(parsed.data.startDate);
  const end = startOfDayFromDateString(parsed.data.endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
  }
  if (end.getTime() < start.getTime()) {
    return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
  }

  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      userId: authUser.id,
      status: { in: ["pending", "approved"] },
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });
  if (overlapping) {
    return NextResponse.json(
      { error: `You already have a ${overlapping.status} leave request that overlaps with these dates.` },
      { status: 400 },
    );
  }

  const leave = await prisma.leaveRequest.create({
    data: {
      userId: authUser.id,
      startDate: start,
      endDate: end,
      reason: parsed.data.reason?.trim() ? parsed.data.reason.trim() : null,
      leaveType: parsed.data.leaveType ?? "annual",
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      reason: true,
      status: true,
      leaveType: true,
      createdAt: true,
    },
  });

  const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const requester = await prisma.user.findUnique({ where: { id: authUser.id }, select: { name: true } });
  await notifyAdmins({
    type: "leave_submitted",
    title: `New leave request from ${requester?.name ?? "an employee"}`,
    body: `${parsed.data.leaveType ?? "annual"} · ${days} day${days === 1 ? "" : "s"} · ${parsed.data.startDate} → ${parsed.data.endDate}${parsed.data.reason ? ` · "${parsed.data.reason}"` : ""}`,
    link: "/admin/leaves",
  });

  logActivity(
    authUser.id,
    "leave_submitted",
    "leave",
    `${leave.leaveType} leave · ${leave.startDate.toISOString().slice(0, 10)} → ${leave.endDate.toISOString().slice(0, 10)}`,
  ).catch(() => null);

  return NextResponse.json({ leave });
}
