import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../../lib/auth";

async function getAdmin(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const user = await verifyAccessToken(token);
  assertRole(user, ["admin"]);
  return user;
}

const QuerySchema = z.object({
  type: z.enum(["monthly_summary", "late_arrivals", "overtime", "absent_today"]),
  month: z.string().optional(),
  year: z.string().optional(),
  userId: z.string().optional(),
});

export async function GET(req: Request) {
  try { await getAdmin(req); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    type: searchParams.get("type") ?? "monthly_summary",
    month: searchParams.get("month") ?? undefined,
    year: searchParams.get("year") ?? undefined,
    userId: searchParams.get("userId") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const { type, userId } = parsed.data;
  const now = new Date();
  const year = parseInt(parsed.data.year ?? String(now.getUTCFullYear()), 10);
  const month = parseInt(parsed.data.month ?? String(now.getUTCMonth() + 1), 10);

  if (type === "absent_today") {
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const [allActive, todaySessions, approvedLeaves, outstationToday, holidayToday] = await Promise.all([
      prisma.user.findMany({
        where: { isActive: true, role: { in: ["employee", "manager"] } },
        select: { id: true, name: true, email: true, department: true, jobTitle: true, phone: true },
      }),
      prisma.attendanceSession.findMany({
        where: { workDate: { gte: today, lt: tomorrow }, checkInAt: { not: null } },
        select: { userId: true },
      }),
      prisma.leaveRequest.findMany({
        where: { status: "approved", startDate: { lte: today }, endDate: { gte: today } },
        select: { userId: true },
      }),
      prisma.outstationDay.findMany({
        where: { startDate: { lte: today }, endDate: { gte: today } },
        select: { userId: true },
      }),
      prisma.holiday.findFirst({
        where: { date: { gte: today, lt: tomorrow } },
        select: { id: true, name: true },
      }),
    ]);

    const presentIds    = new Set(todaySessions.map((s) => s.userId));
    const onLeaveIds    = new Set(approvedLeaves.map((l) => l.userId));
    const outstationIds = new Set(outstationToday.map((o) => o.userId));

    // Absent = not present, not on approved leave, not on outstation
    const absent      = allActive.filter((u) => !presentIds.has(u.id) && !onLeaveIds.has(u.id) && !outstationIds.has(u.id));
    const onLeave     = allActive.filter((u) => onLeaveIds.has(u.id));
    const onOutstation = allActive.filter((u) => outstationIds.has(u.id) && !onLeaveIds.has(u.id));
    const present     = allActive.filter((u) => presentIds.has(u.id));

    return NextResponse.json({
      type, absent, onLeave, onOutstation, present,
      total: allActive.length,
      holiday: holidayToday ?? null,
    });
  }

  if (type === "monthly_summary") {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    const sessions = await prisma.attendanceSession.findMany({
      where: {
        workDate: { gte: start, lte: end },
        ...(userId ? { userId } : {}),
      },
      include: { user: { select: { id: true, name: true, department: true } } },
      orderBy: [{ userId: "asc" }, { workDate: "asc" }],
    });

    const leaves = await prisma.leaveRequest.findMany({
      where: {
        status: "approved",
        startDate: { lte: end },
        endDate: { gte: start },
        ...(userId ? { userId } : {}),
      },
      select: { userId: true, startDate: true, endDate: true, leaveType: true },
    });

    const summaryMap = new Map<string, {
      userId: string; userName: string; department: string | null;
      present: number; absent: number; late: number; earlyDeparture: number;
      overtime: number; leaveDays: number; totalHours: number;
    }>();

    for (const s of sessions) {
      const key = s.userId;
      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          userId: s.userId, userName: s.user.name, department: s.user.department,
          present: 0, absent: 0, late: 0, earlyDeparture: 0, overtime: 0, leaveDays: 0, totalHours: 0,
        });
      }
      const entry = summaryMap.get(key)!;
      if (s.checkInAt) {
        entry.present++;
        if (s.isLateArrival) entry.late++;
        if (s.isEarlyDeparture) entry.earlyDeparture++;
        if (s.isOvertime) entry.overtime++;
        if (s.checkInAt && s.checkOutAt) {
          const hrs = (s.checkOutAt.getTime() - s.checkInAt.getTime()) / 3600000;
          entry.totalHours = Math.round((entry.totalHours + hrs) * 100) / 100;
        }
      }
    }

    // Add leave days
    for (const l of leaves) {
      const start2 = l.startDate > start ? l.startDate : start;
      const end2 = l.endDate < end ? l.endDate : end;
      const days = Math.round((end2.getTime() - start2.getTime()) / 86400000) + 1;
      if (!summaryMap.has(l.userId)) {
        const u = sessions.find((s) => s.userId === l.userId);
        summaryMap.set(l.userId, {
          userId: l.userId, userName: u?.user.name ?? "Unknown",
          department: u?.user.department ?? null,
          present: 0, absent: 0, late: 0, earlyDeparture: 0, overtime: 0, leaveDays: 0, totalHours: 0,
        });
      }
      summaryMap.get(l.userId)!.leaveDays += days;
    }

    return NextResponse.json({ type, year, month, summaries: Array.from(summaryMap.values()) });
  }

  if (type === "late_arrivals") {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    const sessions = await prisma.attendanceSession.findMany({
      where: {
        workDate: { gte: start, lte: end },
        isLateArrival: true,
        ...(userId ? { userId } : {}),
      },
      include: { user: { select: { id: true, name: true, department: true } } },
      orderBy: [{ workDate: "desc" }],
    });

    const rows = sessions.map((s) => ({
      userId: s.userId, userName: s.user.name, department: s.user.department,
      date: s.workDate.toISOString().slice(0, 10),
      checkInAt: s.checkInAt?.toISOString() ?? null,
      minutesLate: s.minutesLate ?? 0,
    }));

    return NextResponse.json({ type, year, month, rows });
  }

  if (type === "overtime") {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    const sessions = await prisma.attendanceSession.findMany({
      where: {
        workDate: { gte: start, lte: end },
        isOvertime: true,
        ...(userId ? { userId } : {}),
      },
      include: { user: { select: { id: true, name: true, department: true } } },
      orderBy: [{ workDate: "desc" }],
    });

    const rows = sessions.map((s) => ({
      userId: s.userId, userName: s.user.name, department: s.user.department,
      date: s.workDate.toISOString().slice(0, 10),
      checkInAt: s.checkInAt?.toISOString() ?? null,
      checkOutAt: s.checkOutAt?.toISOString() ?? null,
      hoursWorked: s.checkInAt && s.checkOutAt
        ? Math.round(((s.checkOutAt.getTime() - s.checkInAt.getTime()) / 3600000) * 100) / 100
        : null,
    }));

    return NextResponse.json({ type, year, month, rows });
  }

  return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
}
