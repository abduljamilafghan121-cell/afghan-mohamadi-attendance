import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../lib/auth";
import { notifyUser } from "../../../../lib/notify";
import { logActivity } from "../../../../lib/activityLog";

function countLeaveDays(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;
}

const DecideSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["approved", "rejected"]),
});

export async function GET(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let authUser;
  try {
    authUser = await verifyAccessToken(token);
    assertRole(authUser, ["manager", "admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") ?? "pending";

  const teamIds = await prisma.user
    .findMany({ where: { managerId: authUser.id, isActive: true }, select: { id: true } })
    .then((us) => us.map((u) => u.id));

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      userId: { in: teamIds },
      ...(statusFilter !== "all" ? { status: statusFilter as any } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      reason: true,
      status: true,
      decidedAt: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
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
    assertRole(authUser, ["manager", "admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = DecideSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const leave = await prisma.leaveRequest.findUnique({
    where: { id: parsed.data.id },
    include: { user: true },
  });
  if (!leave) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (leave.user.managerId !== authUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (leave.status !== "pending") {
    return NextResponse.json({ error: "Already decided" }, { status: 400 });
  }

  const existing = await prisma.leaveRequest.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, status: true, userId: true, startDate: true, endDate: true, leaveType: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.leaveRequest.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status, decidedAt: new Date(), decidedById: authUser.id },
    select: { id: true, status: true, decidedAt: true, startDate: true, endDate: true, leaveType: true },
  });

  const days = countLeaveDays(existing.startDate, existing.endDate);
  const year = existing.startDate.getUTCFullYear();
  const leaveType = existing.leaveType;

  if (parsed.data.status === "approved" && existing.status !== "approved") {
    await prisma.leaveBalance.upsert({
      where: { userId_year_leaveType: { userId: existing.userId, year, leaveType } },
      create: { userId: existing.userId, year, leaveType, entitlementDays: 0, usedDays: days },
      update: { usedDays: { increment: days } },
    });
  } else if (parsed.data.status === "rejected" && existing.status === "approved") {
    await prisma.leaveBalance.upsert({
      where: { userId_year_leaveType: { userId: existing.userId, year, leaveType } },
      create: { userId: existing.userId, year, leaveType, entitlementDays: 0, usedDays: 0 },
      update: { usedDays: { decrement: days } },
    });
  }

  await notifyUser({
    userId: existing.userId,
    type: "leave_decided",
    title: `Your leave request was ${parsed.data.status}`,
    body: `${leaveType} · ${days} day${days === 1 ? "" : "s"} · ${existing.startDate.toISOString().slice(0, 10)} → ${existing.endDate.toISOString().slice(0, 10)}`,
    link: "/profile",
  });

  logActivity(
    authUser.id,
    `leave_${parsed.data.status}`,
    "manager",
    `Leave ${parsed.data.status} for user ${existing.userId} · ${leaveType} · ${existing.startDate.toISOString().slice(0, 10)} → ${existing.endDate.toISOString().slice(0, 10)}`,
  ).catch(() => null);

  return NextResponse.json({ leave: updated });
}
