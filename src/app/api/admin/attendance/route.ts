import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../lib/auth";
import { startOfDayFromDateString, startOfDayUtc } from "../../../../lib/qr";
import { isOffDay, startOfDayUtcFromDate } from "../../../../lib/schedule";

function toDateStr(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const QuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  date: z.string().optional(),
  officeId: z.string().optional(),
  userId: z.string().optional(),
  presence: z.enum(["all", "present", "absent"]).optional(),
});

export async function GET(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await verifyAccessToken(token);
    assertRole(user, ["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    startDate: url.searchParams.get("startDate") ?? undefined,
    endDate: url.searchParams.get("endDate") ?? undefined,
    date: url.searchParams.get("date") ?? undefined,
    officeId: url.searchParams.get("officeId") ?? undefined,
    userId: url.searchParams.get("userId") ?? undefined,
    presence: (url.searchParams.get("presence") as any) ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const startDateStr = parsed.data.startDate ?? parsed.data.date;
  const endDateStr = parsed.data.endDate ?? parsed.data.startDate ?? parsed.data.date;

  const start = startDateStr ? startOfDayFromDateString(startDateStr) : startOfDayUtc(new Date());
  const end = endDateStr ? startOfDayFromDateString(endDateStr) : start;
  const effectiveEnd = end < start ? start : end;

  const dates: Date[] = [];
  const cur = new Date(start);
  while (cur <= effectiveEnd && dates.length < 31) {
    dates.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const officeId = parsed.data.officeId?.trim() || null;
  const userId = parsed.data.userId?.trim() || null;
  const presence = parsed.data.presence ?? "all";

  const office = officeId
    ? await prisma.office.findUnique({
        where: { id: officeId },
        select: { id: true, timezone: true, name: true, weeklyOffDays: true },
      })
    : null;

  const offices = !officeId
    ? await prisma.office.findMany({ select: { id: true, timezone: true, weeklyOffDays: true } })
    : null;

  const sessions = await prisma.attendanceSession.findMany({
    where: {
      workDate: { gte: start, lte: effectiveEnd },
      ...(officeId ? { officeId } : {}),
      ...(userId ? { userId } : {}),
    },
    select: {
      id: true,
      userId: true,
      workDate: true,
      status: true,
      checkInAt: true,
      checkOutAt: true,
      isLateArrival: true,
      isEarlyDeparture: true,
      isOvertime: true,
      minutesLate: true,
      minutesEarlyDeparture: true,
      office: { select: { id: true, name: true, timezone: true, weeklyOffDays: true } },
    },
  });

  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: start, lte: effectiveEnd } },
    select: { date: true, name: true },
  });
  const holidayDates = new Set(holidays.map((h) => toDateStr(h.date)));
  const holidayNames = new Map(holidays.map((h) => [toDateStr(h.date), h.name]));

  const overrides = await prisma.workdayOverride.findMany({
    where: {
      date: { gte: start, lte: effectiveEnd },
      ...(userId ? { userId } : {}),
    },
    select: { userId: true, date: true, isOvertime: true },
  });
  const overrideSet = new Set(overrides.map((o) => `${o.userId}::${toDateStr(o.date)}`));

  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
      status: "approved",
      startDate: { lte: effectiveEnd },
      endDate: { gte: start },
      ...(userId ? { userId } : {}),
    },
    select: { userId: true, startDate: true, endDate: true },
  });

  let allUsers = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["employee", "manager"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  if (userId) {
    allUsers = allUsers.filter((u) => u.id === userId);
  }

  if (officeId) {
    const usersWithOfficeSession = new Set(sessions.map((s) => s.userId));
    allUsers = allUsers.filter((u) => usersWithOfficeSession.has(u.id));
  }

  const sessionsByUserAndDate = new Map<string, (typeof sessions)[0]>();
  for (const s of sessions) {
    const key = `${s.userId}::${toDateStr(s.workDate)}`;
    sessionsByUserAndDate.set(key, s);
  }

  const rows: any[] = [];

  for (const workDate of dates) {
    const dateStr = toDateStr(workDate);
    const dateUtc = startOfDayUtcFromDate(workDate);
    const isHoliday = holidayDates.has(dateStr);
    const holidayName = holidayNames.get(dateStr);

    const tz = office?.timezone ?? "UTC";
    const weeklyOff = office?.weeklyOffDays ?? [5];
    const offDay = isOffDay(workDate, weeklyOff, tz);

    for (const u of allUsers) {
      const s = sessionsByUserAndDate.get(`${u.id}::${dateStr}`) ?? null;
      const isPresent = Boolean(s?.checkInAt);
      const hasOverride = overrideSet.has(`${u.id}::${dateStr}`);

      const isLeave = approvedLeaves.some(
        (l) =>
          l.userId === u.id &&
          new Date(l.startDate) <= workDate &&
          new Date(l.endDate) >= workDate
      );

      const isDayOff = (offDay || isHoliday) && !hasOverride;
      const effectiveAbsent = !isPresent && !isLeave && !isDayOff;

      let status: string;
      if (isPresent) {
        status = s?.isOvertime ? "overtime" : (s?.status ?? "present");
      } else if (isLeave) {
        status = "leave";
      } else if (isHoliday && !hasOverride) {
        status = "holiday";
      } else if (offDay && !hasOverride) {
        status = "off";
      } else {
        status = "absent";
      }

      if (presence === "present" && !isPresent) continue;
      if (presence === "absent" && !effectiveAbsent) continue;

      rows.push({
        date: dateStr,
        sessionId: s?.id ?? null,
        user: u,
        present: isPresent,
        office: s?.office ?? null,
        checkInAt: s?.checkInAt ?? null,
        checkOutAt: s?.checkOutAt ?? null,
        status,
        isLateArrival: s?.isLateArrival ?? false,
        isEarlyDeparture: s?.isEarlyDeparture ?? false,
        isOvertime: s?.isOvertime ?? false,
        minutesLate: s?.minutesLate ?? null,
        minutesEarlyDeparture: s?.minutesEarlyDeparture ?? null,
        isHoliday,
        holidayName: holidayName ?? null,
        isOffDay: isDayOff,
        hasWorkdayOverride: hasOverride,
      });
    }
  }

  return NextResponse.json({ rows });
}
