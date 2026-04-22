import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";
import { getBearerToken, verifyAccessToken } from "../../../lib/auth";
import { startOfDayFromDateString } from "../../../lib/qr";
import { notifyAdmins } from "../../../lib/notify";

const CreateSchema = z.object({
  workDate: z.string().min(1),
  requestType: z.enum(["check_in", "check_out", "both"]),
  intendedCheckIn: z.string().optional().nullable(),
  intendedCheckOut: z.string().optional().nullable(),
  reason: z.string().min(1),
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

  const requests = await prisma.correctionRequest.findMany({
    where: { userId: authUser.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      workDate: true,
      requestType: true,
      intendedCheckIn: true,
      intendedCheckOut: true,
      reason: true,
      status: true,
      decidedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ requests });
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
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const workDate = startOfDayFromDateString(parsed.data.workDate);
  if (isNaN(workDate.getTime())) return NextResponse.json({ error: "Invalid workDate" }, { status: 400 });

  const intendedCheckIn = parsed.data.intendedCheckIn ? new Date(parsed.data.intendedCheckIn) : null;
  const intendedCheckOut = parsed.data.intendedCheckOut ? new Date(parsed.data.intendedCheckOut) : null;

  if (intendedCheckIn && isNaN(intendedCheckIn.getTime()))
    return NextResponse.json({ error: "Invalid intendedCheckIn" }, { status: 400 });
  if (intendedCheckOut && isNaN(intendedCheckOut.getTime()))
    return NextResponse.json({ error: "Invalid intendedCheckOut" }, { status: 400 });

  const existing = await prisma.attendanceSession.findUnique({
    where: { userId_workDate: { userId: authUser.id, workDate } },
    select: { id: true },
  });

  const request = await prisma.correctionRequest.create({
    data: {
      userId: authUser.id,
      sessionId: existing?.id ?? null,
      workDate,
      requestType: parsed.data.requestType,
      intendedCheckIn,
      intendedCheckOut,
      reason: parsed.data.reason,
    },
    select: {
      id: true,
      workDate: true,
      requestType: true,
      intendedCheckIn: true,
      intendedCheckOut: true,
      reason: true,
      status: true,
      createdAt: true,
    },
  });

  const requester = await prisma.user.findUnique({ where: { id: authUser.id }, select: { name: true } });
  await notifyAdmins({
    type: "correction_submitted",
    title: `New correction request from ${requester?.name ?? "an employee"}`,
    body: `${parsed.data.requestType.replace("_", " ")} · ${parsed.data.workDate}${parsed.data.reason ? ` · "${parsed.data.reason}"` : ""}`,
    link: "/admin/corrections",
  });

  return NextResponse.json({ request });
}
