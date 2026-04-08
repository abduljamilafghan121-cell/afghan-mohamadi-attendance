import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { getBearerToken, verifyAccessToken } from "../../../../lib/auth";
import { hashQrToken, startOfDayInTimeZone } from "../../../../lib/qr";
import { isWithinRadius } from "../../../../lib/geo";
import { calcEarlyDepartureMinutes } from "../../../../lib/schedule";

const BodySchema = z.object({
  officeId: z.string().min(1),
  qrPayload: z.string().min(1),
  gps: z.object({
    lat: z.number(),
    lng: z.number(),
    accuracyM: z.number().optional(),
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

  let parsed: any;
  try {
    parsed = JSON.parse(body.data.qrPayload);
  } catch {
    return NextResponse.json({ error: "Invalid QR payload" }, { status: 400 });
  }
  if (!parsed?.token || typeof parsed.token !== "string") {
    return NextResponse.json({ error: "Invalid QR payload" }, { status: 400 });
  }

  const qrTokenHash = hashQrToken(parsed.token);
  const now = new Date();

  const qr = await prisma.dailyQrToken.findFirst({
    where: {
      officeId: office.id,
      tokenHash: qrTokenHash,
      validFrom: { lte: now },
      validTo: { gte: now },
      OR: [{ purpose: "both" }, { purpose: "check_out" }],
    },
  });

  if (!qr) {
    return NextResponse.json({ error: "QR invalid or expired" }, { status: 400 });
  }

  const workDate = startOfDayInTimeZone(now, office.timezone ?? "UTC");
  const session = await prisma.attendanceSession.findUnique({
    where: { userId_workDate: { userId: authUser.id, workDate } },
  });

  if (!session?.checkInAt) {
    return NextResponse.json({ error: "Not checked in" }, { status: 400 });
  }
  if (session.checkOutAt) {
    return NextResponse.json({ error: "Already checked out" }, { status: 400 });
  }

  let minutesEarlyDeparture: number | null = null;
  let isEarlyDeparture = false;
  if (office.workEndTime && !session.isOvertime) {
    const early = calcEarlyDepartureMinutes(now, office.workEndTime, office.timezone ?? "UTC");
    if (early > 0) {
      isEarlyDeparture = true;
      minutesEarlyDeparture = early;
    }
  }

  const event = await prisma.attendanceEvent.create({
    data: {
      sessionId: session.id,
      type: "check_out",
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
    data: { checkOutAt: now, status: "closed", isEarlyDeparture, minutesEarlyDeparture },
  });

  return NextResponse.json({
    sessionId: session.id,
    eventId: event.id,
    checkOutAt: now,
    isEarlyDeparture,
    minutesEarlyDeparture,
  });
}
