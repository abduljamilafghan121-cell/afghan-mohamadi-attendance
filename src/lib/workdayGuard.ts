import { prisma } from "./prisma";
import { startOfDayInTimeZone } from "./qr";
import { isOffDay, startOfDayUtcFromDate } from "./schedule";
import type { Role } from "./auth";

export type WorkdayGuardResult =
  | { allowed: true; isOvertime: boolean; reason?: string }
  | { allowed: false; status: number; error: string };

async function getDefaultOffice() {
  return prisma.office.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Decide whether the given user is allowed to perform a work action
 * (visit / order / collection / new customer / etc.) right now.
 *
 * Rules:
 *  - Admins are always allowed.
 *  - If the user has an approved leave that covers today → blocked.
 *  - If today is a public holiday or a weekly off day:
 *      - Allowed only if an admin has created a WorkdayOverride for the
 *        user marking today as overtime (same mechanism as check-in).
 *      - In that case `isOvertime` will be true so callers can tag the
 *        record / activity log.
 *  - Outstation days are NOT blocked — salesmen are expected to work
 *    while travelling.
 */
export async function checkCanWorkToday(
  userId: string,
  role: Role,
): Promise<WorkdayGuardResult> {
  if (role === "admin") {
    return { allowed: true, isOvertime: false };
  }

  const office = await getDefaultOffice();

  const timezone = office?.timezone ?? "UTC";
  const weeklyOffDays = office?.weeklyOffDays ?? [5];

  const now = new Date();
  const workDate = startOfDayInTimeZone(now, timezone);
  const workDateUtc = startOfDayUtcFromDate(workDate);

  const approvedLeave = await prisma.leaveRequest.findFirst({
    where: {
      userId,
      status: "approved",
      startDate: { lte: workDateUtc },
      endDate: { gte: workDateUtc },
    },
    select: { startDate: true, endDate: true, leaveType: true },
  });
  if (approvedLeave) {
    return {
      allowed: false,
      status: 403,
      error:
        "You are on approved leave today. Sales actions are disabled. Please contact an admin if you need to work.",
    };
  }

  const offDay = isOffDay(workDate, weeklyOffDays, timezone);
  const holiday = await prisma.holiday.findFirst({ where: { date: workDateUtc } });

  let isOvertime = false;
  if (offDay || holiday) {
    const override = await prisma.workdayOverride.findUnique({
      where: { userId_date: { userId, date: workDateUtc } },
    });
    if (!override?.isOvertime) {
      const label = holiday
        ? `a public holiday (${holiday.name})`
        : "your weekly off day";
      return {
        allowed: false,
        status: 403,
        error: `Today is ${label}. You are not scheduled to work. Contact an admin to allow you to work today.`,
      };
    }
    isOvertime = true;
  }

  // Require an attendance check-in for today before any sales action.
  // Users on outstation work outside the office and are not expected to
  // check in via the office QR, so they are exempted.
  const onOutstation = await prisma.outstationDay.findFirst({
    where: {
      userId,
      startDate: { lte: workDateUtc },
      endDate: { gte: workDateUtc },
    },
    select: { id: true },
  });

  if (!onOutstation) {
    const session = await prisma.attendanceSession.findUnique({
      where: { userId_workDate: { userId, workDate } },
      select: { checkInAt: true },
    });
    if (!session || !session.checkInAt) {
      return {
        allowed: false,
        status: 403,
        error:
          "Please check in first. Sales actions are blocked until you check in for today (or have an approved check-in correction).",
      };
    }
  }

  return { allowed: true, isOvertime, reason: isOvertime ? "overtime override" : undefined };
}

/**
 * Decide whether a target user can be scheduled to work on a specific date
 * (used when admin creates / moves a visit plan, or when template plans are
 * auto-generated for a future date).
 *
 * Same rules as checkCanWorkToday but evaluated for `targetDate` against the
 * target user (the userId being scheduled), not the actor. This means:
 *  - If the target user is an admin, scheduling is always allowed.
 *  - Otherwise we check holiday / weekly off-day / approved leave for that
 *    specific date, with WorkdayOverride still acting as the overtime
 *    bypass.
 */
export async function checkCanWorkOnDate(
  targetUserId: string,
  targetDate: Date,
): Promise<WorkdayGuardResult> {
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { role: true },
  });
  if (targetUser?.role === "admin") {
    return { allowed: true, isOvertime: false };
  }

  const office = await getDefaultOffice();
  const timezone = office?.timezone ?? "UTC";
  const weeklyOffDays = office?.weeklyOffDays ?? [5];

  const workDate = startOfDayInTimeZone(targetDate, timezone);
  const workDateUtc = startOfDayUtcFromDate(workDate);

  const approvedLeave = await prisma.leaveRequest.findFirst({
    where: {
      userId: targetUserId,
      status: "approved",
      startDate: { lte: workDateUtc },
      endDate: { gte: workDateUtc },
    },
    select: { startDate: true, endDate: true },
  });
  if (approvedLeave) {
    return {
      allowed: false,
      status: 403,
      error:
        "This salesman is on approved leave on the selected date. Pick another date or recall the leave first.",
    };
  }

  const offDay = isOffDay(workDate, weeklyOffDays, timezone);
  const holiday = await prisma.holiday.findFirst({ where: { date: workDateUtc } });

  if (offDay || holiday) {
    const override = await prisma.workdayOverride.findUnique({
      where: { userId_date: { userId: targetUserId, date: workDateUtc } },
    });
    if (override?.isOvertime) {
      return { allowed: true, isOvertime: true, reason: "overtime override" };
    }
    const label = holiday
      ? `a public holiday (${holiday.name})`
      : "a weekly off day";
    return {
      allowed: false,
      status: 403,
      error: `The selected date is ${label} for this salesman. Mark it as overtime first or pick another date.`,
    };
  }

  return { allowed: true, isOvertime: false };
}

