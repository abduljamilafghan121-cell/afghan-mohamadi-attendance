import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../lib/auth";
import { startOfDayFromDateString, startOfDayUtc } from "../../../../lib/qr";

function toDateStr(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoWeek(d: Date) {
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const dayOfYear = Math.floor((d.getTime() - new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).getTime()) / 86400000) + 1;
  const weekNum = Math.ceil((dayOfYear + ((new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function isoMonth(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const QuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  userId: z.string().optional(),
  officeId: z.string().optional(),
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
    userId: url.searchParams.get("userId") ?? undefined,
    officeId: url.searchParams.get("officeId") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const now = new Date();
  const start = parsed.data.startDate ? startOfDayFromDateString(parsed.data.startDate) : startOfDayUtc(new Date(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = parsed.data.endDate ? startOfDayFromDateString(parsed.data.endDate) : startOfDayUtc(now);
  const effectiveEnd = end < start ? start : end;

  const sessions = await prisma.attendanceSession.findMany({
    where: {
      workDate: { gte: start, lte: effectiveEnd },
      checkInAt: { not: null },
      ...(parsed.data.userId ? { userId: parsed.data.userId } : {}),
      ...(parsed.data.officeId ? { officeId: parsed.data.officeId } : {}),
    },
    select: {
      id: true,
      userId: true,
      workDate: true,
      checkInAt: true,
      checkOutAt: true,
      user: { select: { id: true, name: true, email: true } },
      office: { select: { name: true } },
    },
    orderBy: [{ userId: "asc" }, { workDate: "asc" }],
  });

  type DayRow = {
    date: string;
    userName: string;
    userId: string;
    officeName: string;
    checkInAt: string | null;
    checkOutAt: string | null;
    hoursWorked: number | null;
  };

  type Summary = {
    userId: string;
    userName: string;
    totalHours: number;
    byWeek: Record<string, number>;
    byMonth: Record<string, number>;
  };

  const days: DayRow[] = [];
  const summaryMap = new Map<string, Summary>();

  for (const s of sessions) {
    const hoursWorked =
      s.checkInAt && s.checkOutAt
        ? Math.round(((s.checkOutAt.getTime() - s.checkInAt.getTime()) / 3600000) * 100) / 100
        : null;

    days.push({
      date: toDateStr(s.workDate),
      userId: s.userId,
      userName: s.user.name,
      officeName: s.office.name,
      checkInAt: s.checkInAt ? s.checkInAt.toISOString() : null,
      checkOutAt: s.checkOutAt ? s.checkOutAt.toISOString() : null,
      hoursWorked,
    });

    if (!summaryMap.has(s.userId)) {
      summaryMap.set(s.userId, {
        userId: s.userId,
        userName: s.user.name,
        totalHours: 0,
        byWeek: {},
        byMonth: {},
      });
    }
    if (hoursWorked !== null) {
      const entry = summaryMap.get(s.userId)!;
      entry.totalHours = Math.round((entry.totalHours + hoursWorked) * 100) / 100;
      const week = isoWeek(s.workDate);
      entry.byWeek[week] = Math.round(((entry.byWeek[week] ?? 0) + hoursWorked) * 100) / 100;
      const month = isoMonth(s.workDate);
      entry.byMonth[month] = Math.round(((entry.byMonth[month] ?? 0) + hoursWorked) * 100) / 100;
    }
  }

  return NextResponse.json({ days, summaries: Array.from(summaryMap.values()) });
}
