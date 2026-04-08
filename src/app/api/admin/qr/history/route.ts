import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../../lib/auth";
import { startOfDayFromDateString, startOfDayUtc } from "../../../../../lib/qr";

const QuerySchema = z.object({
  officeId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
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
    officeId: url.searchParams.get("officeId") ?? undefined,
    startDate: url.searchParams.get("startDate") ?? undefined,
    endDate: url.searchParams.get("endDate") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const now = new Date();
  const start = parsed.data.startDate
    ? startOfDayFromDateString(parsed.data.startDate)
    : startOfDayUtc(new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7));
  const end = parsed.data.endDate ? startOfDayFromDateString(parsed.data.endDate) : startOfDayUtc(now);
  const effectiveEnd = new Date(end);
  effectiveEnd.setUTCDate(effectiveEnd.getUTCDate() + 1);

  const tokens = await prisma.dailyQrToken.findMany({
    where: {
      workDate: { gte: start, lt: effectiveEnd },
      ...(parsed.data.officeId ? { officeId: parsed.data.officeId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      workDate: true,
      purpose: true,
      validFrom: true,
      validTo: true,
      createdAt: true,
      office: { select: { id: true, name: true } },
      createdByAdmin: { select: { id: true, name: true } },
      _count: { select: { attendanceEvents: true } },
    },
    take: 200,
  });

  return NextResponse.json({ tokens });
}
