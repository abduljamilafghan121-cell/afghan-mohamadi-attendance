import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../lib/auth";

const DecideSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["approved", "rejected"]),
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
  const statusFilter = url.searchParams.get("status") ?? "pending";

  const teamIds = await prisma.user
    .findMany({ where: { managerId: authUser.id, isActive: true }, select: { id: true } })
    .then((us) => us.map((u) => u.id));

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      userId: { in: teamIds },
      ...(statusFilter !== "all" ? { status: statusFilter as any } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      reason: true,
      status: true,
      decidedAt: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ leaves });
}

export async function POST(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let authUser;
  try {
    authUser = await verifyAccessToken(token);
    assertRole(authUser, ["manager", "admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = DecideSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const leave = await prisma.leaveRequest.findUnique({
    where: { id: parsed.data.id },
    include: { user: true },
  });
  if (!leave) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (leave.user.managerId !== authUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (leave.status !== "pending") {
    return NextResponse.json({ error: "Already decided" }, { status: 400 });
  }

  const updated = await prisma.leaveRequest.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status, decidedAt: new Date(), decidedById: authUser.id },
    select: { id: true, status: true, decidedAt: true },
  });

  return NextResponse.json({ leave: updated });
}
