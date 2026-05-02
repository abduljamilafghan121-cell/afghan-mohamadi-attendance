import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../lib/auth";
import { startOfDayUtc } from "../../../../lib/qr";
import { isOffDay } from "../../../../lib/schedule";

export async function GET(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await verifyAccessToken(token);
    assertRole(user, ["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = startOfDayUtc(new Date());
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const [
    allActiveUsers,
    todaySessions,
    approvedLeaves,
    outstationToday,
    holidayToday,
    offices,
    workdayOverrides,
    pendingLeaves,
    pendingCorrections,
  ] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, role: { in: ["employee", "manager"] } },
      select: { id: true, name: true, email: true, department: true, jobTitle: true },
    }),
    prisma.attendanceSession.findMany({
      where: { workDate: { gte: today, lt: tomorrow } },
      select: {
        id: true,
        status: true,
        checkInAt: true,
        checkOutAt: true,
        user: { select: { id: true, name: true, email: true, role: true } },
        office: { select: { id: true, name: true } },
      },
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
    prisma.office.findMany({
      where: { isActive: true },
      select: { id: true, name: true, weeklyOffDays: true, timezone: true },
    }),
    prisma.workdayOverride.findMany({
      where: { date: today, isOvertime: true },
      select: { userId: true },
    }),
    prisma.leaveRequest.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, startDate: true, endDate: true, reason: true, createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.correctionRequest.count({ where: { status: "pending" } }),
  ]);

  // Determine off-day status (same logic as HR reports)
  const offDayInfo = offices.map((o) => ({
    name: o.name,
    isOff: isOffDay(today, o.weeklyOffDays, o.timezone ?? "UTC"),
  }));
  const allOfficesOnBreak = offDayInfo.length > 0 && offDayInfo.every((o) => o.isOff);

  const overrideIds    = new Set(workdayOverrides.map((w) => w.userId));
  const presentIds     = new Set(todaySessions.filter((s) => s.checkInAt).map((s) => s.user.id));
  const onLeaveIds     = new Set(approvedLeaves.map((l) => l.userId));
  const outstationIds  = new Set(outstationToday.map((o) => o.userId));

  let absentUsers: typeof allActiveUsers;
  if (allOfficesOnBreak && !holidayToday) {
    // Weekly off day — only those with a workday override are expected
    absentUsers = allActiveUsers.filter(
      (u) => overrideIds.has(u.id) && !presentIds.has(u.id) && !onLeaveIds.has(u.id) && !outstationIds.has(u.id),
    );
  } else {
    absentUsers = allActiveUsers.filter(
      (u) => !presentIds.has(u.id) && !onLeaveIds.has(u.id) && !outstationIds.has(u.id),
    );
  }

  const checkedInSessions = todaySessions.filter((s) => s.checkInAt);
  const totalActive = allActiveUsers.length;
  const presentCount = checkedInSessions.length;
  const onLeaveCount = approvedLeaves.length;
  const onOutstationCount = outstationToday.length;
  const absentCount = absentUsers.length;

  return NextResponse.json({
    stats: {
      totalActive,
      presentCount,
      absentCount,
      onLeaveCount,
      onOutstationCount,
      pendingLeaves: pendingLeaves.length,
      pendingCorrections,
    },
    holiday: holidayToday ?? null,
    isOffDay: allOfficesOnBreak && !holidayToday,
    absentUsers,
    checkedIn: checkedInSessions.map((s) => ({
      userId: s.user.id,
      name: s.user.name,
      email: s.user.email,
      officeName: s.office?.name ?? null,
      checkInAt: s.checkInAt,
      checkOutAt: s.checkOutAt,
      status: s.status,
    })),
    pendingLeaves,
  });
}
