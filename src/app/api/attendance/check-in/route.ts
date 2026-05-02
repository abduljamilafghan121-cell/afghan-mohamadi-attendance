import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { getBearerToken, verifyAccessToken } from "../../../../lib/auth";
import { logActivity } from "../../../../lib/activityLog";
import { startOfDayInTimeZone } from "../../../../lib/qr";
import { validateQrForAttendance } from "../../../../lib/qrValidate";
import { notifyAdmins, notifyUser } from "../../../../lib/notify";
import { isWithinRadius } from "../../../../lib/geo";
import { isOffDay, calcLateMinutes, startOfDayUtcFromDate } from "../../../../lib/schedule";

const BodySchema = z.object({
  officeId: z.string().min(1),
  qrPayload: z.string().min(1),
  gps: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracyM: z.number().nonnegative().optional(),
  }),
});

export async function POST(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let authUser;
  try {
    authUser = await verifyAccessToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const office = await prisma.office.findUnique({ where: { id: body.data.officeId } });
  if (!office || !office.isActive) {
    return NextResponse.json({ error: "Office not found" }, { status: 404 });
  }

  const gpsOk = isWithinRadius(
    body.data.gps.lat,
    body.data.gps.lng,
    office.gpsLat,
    office.gpsLng,
    office.gpsRadiusM,
  );
  if (!gpsOk) {
    return NextResponse.json({ error: "Outside office radius" }, { status: 400 });
  }

  const now = new Date();
  const qrCheck = await validateQrForAttendance({
    qrPayload: body.data.qrPayload,
    scanFor: "check_in",
    scannedOfficeId: office.id,
    officeTimezone: office.timezone ?? "UTC",
    now,
  });
  if (!qrCheck.ok) {
    return NextResponse.json(
      { error: qrCheck.message, code: qrCheck.code, details: qrCheck.details },
      { status: qrCheck.status },
    );
  }
  const qr = qrCheck.qr;

  const workDate = startOfDayInTimeZone(now, office.timezone ?? "UTC");
  const workDateUtc = startOfDayUtcFromDate(workDate);

  const existing = await prisma.attendanceSession.findUnique({
    where: { userId_workDate: { userId: authUser.id, workDate } },
    include: { events: true },
  });

  if (existing?.checkInAt) {
    return NextResponse.json({ error: "Already checked in" }, { status: 400 });
  }

  const offDay = isOffDay(workDate, office.weeklyOffDays, office.timezone ?? "UTC");
  const holiday = await prisma.holiday.findFirst({ where: { date: workDateUtc } });

  let sessionIsOvertime = false;
  if (offDay || holiday) {
    const override = await prisma.workdayOverride.findUnique({
      where: { userId_date: { userId: authUser.id, date: workDateUtc } },
    });
    sessionIsOvertime = Boolean(override?.isOvertime);
    if (!sessionIsOvertime) {
      const label = holiday ? `a public holiday (${holiday.name})` : "a weekly off day";
      return NextResponse.json(
        { error: `Today is ${label}. You are not scheduled to work. Contact an admin to allow you to work today.` },
        { status: 403 }
      );
    }
  }

  let minutesLate: number | null = null;
  let isLateArrival = false;
  if (office.workStartTime && !sessionIsOvertime) {
    const late = calcLateMinutes(now, office.workStartTime, office.timezone ?? "UTC");
    if (late > 0) {
      isLateArrival = true;
      minutesLate = late;
    }
  }

  const session = await prisma.attendanceSession.upsert({
    where: { userId_workDate: { userId: authUser.id, workDate } },
    update: { officeId: office.id, status: "open" },
    create: {
      userId: authUser.id,
      officeId: office.id,
      workDate,
      status: "open",
    },
  });

  const event = await prisma.attendanceEvent.create({
    data: {
      sessionId: session.id,
      type: "check_in",
      serverTimeUtc: now,
      gpsLat: body.data.gps.lat,
      gpsLng: body.data.gps.lng,
      gpsAccuracyM: body.data.gps.accuracyM,
      qrTokenId: qr.id,
      validationPassed: true,
    },
  });

  await prisma.attendanceSession.update({
    where: { id: session.id },
    data: { checkInAt: now, isLateArrival, minutesLate, isOvertime: sessionIsOvertime },
  });

  if (isLateArrival && minutesLate && minutesLate > 0) {
    const employee = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { name: true, managerId: true },
    });
    await notifyAdmins({
      type: "late_check_in",
      title: `Late check-in: ${employee?.name ?? "employee"}`,
      body: `${minutesLate} min late at ${office.name} · ${now.toLocaleString()}`,
      link: "/admin/attendance",
    });
    if (employee?.managerId) {
      await notifyUser({
        userId: employee.managerId,
        type: "late_check_in",
        title: `Late check-in: ${employee.name}`,
        body: `${minutesLate} min late at ${office.name} · ${now.toLocaleString()}`,
        link: "/manager",
      });
    }
  }

  logActivity(
    authUser.id,
    "check_in",
    "attendance",
    `Checked in at ${office.name}${isLateArrival ? ` · ${minutesLate} min late` : ""}${sessionIsOvertime ? " · overtime" : ""}`,
  ).catch(() => null);

  return NextResponse.json({
    sessionId: session.id,
    eventId: event.id,
    checkInAt: now,
    isLateArrival,
    minutesLate,
    isOvertime: sessionIsOvertime,
  });
}
