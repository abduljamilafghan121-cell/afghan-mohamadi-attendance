import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../lib/auth";
import { notifyUser } from "../../../../lib/notify";
import { logActivity } from "../../../../lib/activityLog";

const QuerySchema = z.object({
  status: z.enum(["all", "pending", "approved", "rejected"]).optional(),
});

const DecideSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["approved", "rejected"]),
});

function countLeaveDays(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;
}

export async function GET(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let admin;
  try {
    admin = await verifyAccessToken(token);
    assertRole(admin, ["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    status: (url.searchParams.get("status") as any) ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const status = parsed.data.status ?? "pending";
  const where = status === "all" ? {} : { status };

  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "50", 10) || 50), 200);

  const [leaves, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
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
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return NextResponse.json({ leaves, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

export async function POST(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let admin;
  try {
    admin = await verifyAccessToken(token);
    assertRole(admin, ["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = DecideSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const existing = await prisma.leaveRequest.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, status: true, userId: true, startDate: true, endDate: true, leaveType: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const days = countLeaveDays(existing.startDate, existing.endDate);
  const year = existing.startDate.getUTCFullYear();
  const leaveType = existing.leaveType;

  const leave = await prisma.leaveRequest.update({
    where: { id: parsed.data.id },
    data: {
      status: parsed.data.status,
      decidedAt: new Date(),
      decidedById: admin.id,
    },
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
      user: { select: { id: true, name: true, email: true } },
    },
  });

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
    body: `${leave.leaveType} · ${days} day${days === 1 ? "" : "s"} · ${leave.startDate.toISOString().slice(0, 10)} → ${leave.endDate.toISOString().slice(0, 10)}`,
    link: "/profile",
  });

  logActivity(
    admin.id,
    `leave_${parsed.data.status}`,
    "admin",
    `Leave ${parsed.data.status} for ${leave.user.name} · ${leave.leaveType} · ${leave.startDate.toISOString().slice(0, 10)} → ${leave.endDate.toISOString().slice(0, 10)}`,
  ).catch(() => null);

  return NextResponse.json({ leave });
}
