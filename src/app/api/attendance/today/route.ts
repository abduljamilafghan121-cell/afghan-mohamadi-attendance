"use server";

import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getBearerToken, verifyAccessToken } from "../../../../lib/auth";
import { startOfDayInTimeZone } from "../../../../lib/qr";

/**
 * GET /api/attendance/today
 * Query parameters:
 *   officeId? - optional, filter by office
 *   startDate? - optional, ISO date string (YYYY-MM-DD)
 *   endDate? - optional, ISO date string (YYYY-MM-DD)
 */
export async function GET(req: Request) {
  // Extract token from Authorization header
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify user token
  let authUser;
  try {
    authUser = await verifyAccessToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const officeId = url.searchParams.get("officeId")?.trim() || null;
  const startDateParam = url.searchParams.get("startDate");
  const endDateParam = url.searchParams.get("endDate");

  // Fetch office timezone if officeId is provided
  const office = officeId
    ? await prisma.office.findUnique({
        where: { id: officeId },
        select: { id: true, timezone: true, name: true },
      })
    : null;

  const timezone = office?.timezone ?? "UTC";

  // Parse start and end dates; default to today if not provided
  const startDate = startDateParam
    ? startOfDayInTimeZone(new Date(startDateParam), timezone)
    : startOfDayInTimeZone(new Date(), timezone);

  const endDate = endDateParam
    ? startOfDayInTimeZone(new Date(endDateParam), timezone)
    : startOfDayInTimeZone(new Date(), timezone);

  // Fetch all attendance sessions for the user in the date range
  const sessions = await prisma.attendanceSession.findMany({
    where: {
      userId: authUser.id,
      officeId: officeId || undefined,
      workDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      id: true,
      workDate: true,
      status: true,
      checkInAt: true,
      checkOutAt: true,
      office: { select: { id: true, name: true, timezone: true } },
    },
    orderBy: { workDate: "desc" },
  });

  return NextResponse.json({
    sessions,
    office,
    message: `Found ${sessions.length} session(s) for user.`,
  });
}
