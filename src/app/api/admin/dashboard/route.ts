import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../lib/auth";
import { startOfDayUtc } from "../../../../lib/qr";

export async function GET(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await verifyAccessToken(token);
    assertRole(user, ["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = startOfDayUtc(new Date());
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const [totalActive, todaySessions, approvedLeaves, pendingLeaves, pendingCorrections] = await Promise.all([
    prisma.user.count({ where: { isActive: true, role: { in: ["employee", "manager"] } } }),
    prisma.attendanceSession.findMany({
      where: { workDate: { gte: today, lt: tomorrow } },
      select: {
        id: true,
        status: true,
        checkInAt: true,
        checkOutAt: true,
        user: { select: { id: true, name: true, email: true, role: true } },
        office: { select: { id: true, name: true } },
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: "approved",
        startDate: { lte: today },
        endDate: { gte: today },
      },
      select: { userId: true },
    }),
    prisma.leaveRequest.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        reason: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.correctionRequest.count({ where: { status: "pending" } }),
  ]);

  const onLeaveUserIds = new Set(approvedLeaves.map((l) => l.userId));
  const checkedInSessions = todaySessions.filter((s) => s.checkInAt);
  const checkedInUserIds = new Set(checkedInSessions.map((s) => s.user.id));

  const presentCount = checkedInSessions.length;
  const onLeaveCount = approvedLeaves.length;
  const absentCount = Math.max(0, totalActive - presentCount - onLeaveCount);

  return NextResponse.json({
    stats: {
      totalActive,
      presentCount,
      absentCount,
      onLeaveCount,
      pendingLeaves: pendingLeaves.length,
      pendingCorrections,
    },
    checkedIn: checkedInSessions.map((s) => ({
      userId: s.user.id,
      name: s.user.name,
      email: s.user.email,
      officeName: s.office?.name ?? null,
      checkInAt: s.checkInAt,
      checkOutAt: s.checkOutAt,
      status: s.status,
    })),
    pendingLeaves,
  });
}
