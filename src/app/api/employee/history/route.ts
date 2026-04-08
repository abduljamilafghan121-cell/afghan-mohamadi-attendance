import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { getBearerToken, verifyAccessToken } from "../../../../lib/auth";
import { startOfDayFromDateString, startOfDayUtc } from "../../../../lib/qr";

function toDateStr(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const QuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function GET(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let authUser;
  try {
    authUser = await verifyAccessToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    startDate: url.searchParams.get("startDate") ?? undefined,
    endDate: url.searchParams.get("endDate") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const now = new Date();
  const start = parsed.data.startDate
    ? startOfDayFromDateString(parsed.data.startDate)
    : startOfDayFromDateString(`${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`);
  const end = parsed.data.endDate ? startOfDayFromDateString(parsed.data.endDate) : startOfDayUtc(now);
  const effectiveEnd = end < start ? start : end;

  const [sessions, leaves] = await Promise.all([
    prisma.attendanceSession.findMany({
      where: { userId: authUser.id, workDate: { gte: start, lte: effectiveEnd } },
      orderBy: { workDate: "desc" },
      select: {
        id: true,
        workDate: true,
        status: true,
        checkInAt: true,
        checkOutAt: true,
        isLateArrival: true,
        isEarlyDeparture: true,
        isOvertime: true,
        minutesLate: true,
        minutesEarlyDeparture: true,
        office: { select: { name: true } },
      },
    }),
    prisma.leaveRequest.findMany({
      where: { userId: authUser.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        reason: true,
        status: true,
        decidedAt: true,
        createdAt: true,
      },
    }),
  ]);

  let totalHours = 0;
  let overtimeHours = 0;
  let presentDays = 0;
  let lateDays = 0;

  const rows = sessions.map((s) => {
    const hoursWorked =
      s.checkInAt && s.checkOutAt
        ? Math.round(((s.checkOutAt.getTime() - s.checkInAt.getTime()) / 3600000) * 100) / 100
        : null;
    if (hoursWorked) totalHours = Math.round((totalHours + hoursWorked) * 100) / 100;
    if (s.isOvertime && hoursWorked) overtimeHours = Math.round((overtimeHours + hoursWorked) * 100) / 100;
    if (s.checkInAt) presentDays++;
    if (s.isLateArrival) lateDays++;
    return {
      date: toDateStr(s.workDate),
      status: s.status,
      checkInAt: s.checkInAt ? s.checkInAt.toISOString() : null,
      checkOutAt: s.checkOutAt ? s.checkOutAt.toISOString() : null,
      officeName: s.office.name,
      hoursWorked,
      isLateArrival: s.isLateArrival,
      isEarlyDeparture: s.isEarlyDeparture,
      isOvertime: s.isOvertime,
      minutesLate: s.minutesLate,
      minutesEarlyDeparture: s.minutesEarlyDeparture,
    };
  });

  const approvedLeaves = leaves.filter((l) => l.status === "approved").length;

  return NextResponse.json({
    rows,
    leaves,
    summary: {
      presentDays,
      totalHours,
      overtimeHours,
      lateDays,
      approvedLeaves,
      pendingLeaves: leaves.filter((l) => l.status === "pending").length,
    },
  });
}
