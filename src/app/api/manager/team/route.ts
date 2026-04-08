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
    assertRole(authUser, ["manager", "admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    startDate: url.searchParams.get("startDate") ?? undefined,
    endDate: url.searchParams.get("endDate") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const start = parsed.data.startDate ? startOfDayFromDateString(parsed.data.startDate) : startOfDayUtc(new Date());
  const end = parsed.data.endDate ? startOfDayFromDateString(parsed.data.endDate) : start;
  const effectiveEnd = end < start ? start : end;

  const teamMembers = await prisma.user.findMany({
    where: { managerId: authUser.id, isActive: true },
    select: { id: true, name: true, email: true, department: true, jobTitle: true },
  });

  const teamIds = teamMembers.map((u) => u.id);

  const sessions = await prisma.attendanceSession.findMany({
    where: {
      userId: { in: teamIds },
      workDate: { gte: start, lte: effectiveEnd },
    },
    select: {
      id: true,
      userId: true,
      workDate: true,
      status: true,
      checkInAt: true,
      checkOutAt: true,
      office: { select: { name: true } },
    },
  });

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      userId: { in: teamIds },
      startDate: { lte: effectiveEnd },
      endDate: { gte: start },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      startDate: true,
      endDate: true,
      reason: true,
      status: true,
      createdAt: true,
    },
  });

  const sessionByUserDate = new Map<string, (typeof sessions)[0]>();
  for (const s of sessions) sessionByUserDate.set(`${s.userId}:${toDateStr(s.workDate)}`, s);

  const dates: Date[] = [];
  const cur = new Date(start);
  while (cur <= effectiveEnd && dates.length < 31) {
    dates.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const rows = teamMembers.flatMap((member) =>
    dates.map((d) => {
      const dateStr = toDateStr(d);
      const session = sessionByUserDate.get(`${member.id}:${dateStr}`);
      const onLeave = leaves.some(
        (l) => l.userId === member.id && l.status === "approved" && l.startDate <= d && l.endDate >= d
      );
      return {
        userId: member.id,
        userName: member.name,
        email: member.email,
        department: member.department,
        date: dateStr,
        status: session ? session.status : onLeave ? "leave" : "absent",
        checkInAt: session?.checkInAt ?? null,
        checkOutAt: session?.checkOutAt ?? null,
        officeName: session?.office?.name ?? null,
      };
    })
  );

  return NextResponse.json({ team: teamMembers, rows, leaves });
}
