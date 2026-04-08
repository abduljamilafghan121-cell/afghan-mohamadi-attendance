import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getBearerToken, verifyAccessToken } from "../../../../lib/auth";
import { isOffDay, startOfDayUtcFromDate } from "../../../../lib/schedule";
import { startOfDayInTimeZone } from "../../../../lib/qr";

export async function GET(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let authUser;
  try {
    authUser = await verifyAccessToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const officeId = searchParams.get("officeId");

  if (!officeId) {
    return NextResponse.json({ isOffDay: false, isHoliday: false, holidayName: null, hasOverride: false, canCheckIn: true });
  }

  const office = await prisma.office.findUnique({ where: { id: officeId } });
  if (!office || !office.isActive) {
    return NextResponse.json({ error: "Office not found" }, { status: 404 });
  }

  const now = new Date();
  const workDate = startOfDayInTimeZone(now, office.timezone ?? "UTC");
  const workDateUtc = startOfDayUtcFromDate(workDate);

  const offDay = isOffDay(workDate, office.weeklyOffDays, office.timezone ?? "UTC");
  const holiday = await prisma.holiday.findFirst({ where: { date: workDateUtc } });

  let hasOverride = false;
  if (offDay || holiday) {
    const override = await prisma.workdayOverride.findUnique({
      where: { userId_date: { userId: authUser.id, date: workDateUtc } },
    });
    hasOverride = Boolean(override?.isOvertime);
  }

  const canCheckIn = !(offDay || !!holiday) || hasOverride;

  return NextResponse.json({
    isOffDay: offDay,
    isHoliday: !!holiday,
    holidayName: holiday?.name ?? null,
    hasOverride,
    canCheckIn,
    offDays: office.weeklyOffDays,
    workStartTime: office.workStartTime,
    workEndTime: office.workEndTime,
  });
}
