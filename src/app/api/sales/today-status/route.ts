import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { requireUser } from "../../../../lib/apiAuth";
import { startOfDayInTimeZone } from "../../../../lib/qr";
import { isOffDay, startOfDayUtcFromDate } from "../../../../lib/schedule";

export const dynamic = "force-dynamic";

/**
 * Returns the current user's workday status for "today":
 *   - whether today is a public holiday / weekly off day
 *   - whether they have an approved leave covering today
 *   - whether an admin has granted them an overtime override
 *   - whether they are allowed to perform sales actions today
 *
 * Used by the sales pages to render a banner so users understand
 * why creating visits / orders / payments / shops may be blocked.
 */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const user = auth.user;

  // Admins can always work — return a quick "ok" payload.
  if (user.role === "admin") {
    return NextResponse.json({
      canWork: true,
      isAdmin: true,
      isOffDay: false,
      isHoliday: false,
      holidayName: null,
      isOnLeave: false,
      leaveType: null,
      hasOverride: false,
      isOvertime: false,
      reason: null,
    });
  }

  const office = await prisma.office.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  const timezone = office?.timezone ?? "UTC";
  const weeklyOffDays = office?.weeklyOffDays ?? [5];

  const now = new Date();
  const workDate = startOfDayInTimeZone(now, timezone);
  const workDateUtc = startOfDayUtcFromDate(workDate);

  const offDay = isOffDay(workDate, weeklyOffDays, timezone);
  const holiday = await prisma.holiday.findFirst({ where: { date: workDateUtc } });

  const approvedLeave = await prisma.leaveRequest.findFirst({
    where: {
      userId: user.id,
      status: "approved",
      startDate: { lte: workDateUtc },
      endDate: { gte: workDateUtc },
    },
    select: { leaveType: true, startDate: true, endDate: true },
  });

  let hasOverride = false;
  if (offDay || holiday) {
    const override = await prisma.workdayOverride.findUnique({
      where: { userId_date: { userId: user.id, date: workDateUtc } },
    });
    hasOverride = Boolean(override?.isOvertime);
  }

  // Leave always blocks (no overtime escape hatch for leave).
  const isOnLeave = Boolean(approvedLeave);
  const blockedByCalendar = (offDay || !!holiday) && !hasOverride;
  const canWork = !isOnLeave && !blockedByCalendar;
  const isOvertime = (offDay || !!holiday) && hasOverride && !isOnLeave;

  let reason: string | null = null;
  if (isOnLeave) {
    reason = "leave";
  } else if (holiday) {
    reason = "holiday";
  } else if (offDay) {
    reason = "offday";
  }

  return NextResponse.json({
    canWork,
    isAdmin: false,
    isOffDay: offDay,
    isHoliday: !!holiday,
    holidayName: holiday?.name ?? null,
    isOnLeave,
    leaveType: approvedLeave?.leaveType ?? null,
    hasOverride,
    isOvertime,
    reason,
  });
}
