import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";
import { getBearerToken, verifyAccessToken } from "../../../lib/auth";
import { startOfDayFromDateString } from "../../../lib/qr";

const CreateSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().optional(),
  leaveType: z.enum(["annual", "sick", "casual", "unpaid"]).optional(),
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

  const leaves = await prisma.leaveRequest.findMany({
    where: { userId: authUser.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      reason: true,
      status: true,
      leaveType: true,
      decidedAt: true,
      decidedById: true,
      createdAt: true,
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
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const start = startOfDayFromDateString(parsed.data.startDate);
  const end = startOfDayFromDateString(parsed.data.endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
  }
  if (end.getTime() < start.getTime()) {
    return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
  }

  const leave = await prisma.leaveRequest.create({
    data: {
      userId: authUser.id,
      startDate: start,
      endDate: end,
      reason: parsed.data.reason?.trim() ? parsed.data.reason.trim() : null,
      leaveType: parsed.data.leaveType ?? "annual",
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      reason: true,
      status: true,
      leaveType: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ leave });
}
