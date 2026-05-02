import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../lib/auth";
import { notifyUser } from "../../../../lib/notify";
import { logActivity } from "../../../../lib/activityLog";
import { calcLateMinutes } from "../../../../lib/schedule";

const DecideSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["approved", "rejected"]),
});

export async function GET(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let admin;
  try {
    admin = await verifyAccessToken(token);
    assertRole(admin, ["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") ?? "pending";

  const requests = await prisma.correctionRequest.findMany({
    where: statusFilter === "all" ? {} : { status: statusFilter as any },
    orderBy: { createdAt: "asc" },
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
      user: { select: { id: true, name: true, email: true } },
      session: { select: { id: true, checkInAt: true, checkOutAt: true, status: true } },
    },
  });

  return NextResponse.json({ requests });
}

export async function POST(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let admin;
  try {
    admin = await verifyAccessToken(token);
    assertRole(admin, ["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = DecideSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const corrReq = await prisma.correctionRequest.findUnique({
    where: { id: parsed.data.id },
    include: {
      session: {
        include: { office: true },
      },
      user: {
        select: { id: true, name: true, officeId: true },
      },
    },
  });
  if (!corrReq) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (corrReq.status !== "pending") {
    return NextResponse.json({ error: "Already decided" }, { status: 400 });
  }

  const ops: any[] = [
    prisma.correctionRequest.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status, decidedAt: new Date(), decidedById: admin.id },
    }),
  ];

  if (parsed.data.status === "approved") {
    if (corrReq.session) {
      const sessionUpdate: Record<string, any> = { status: "corrected" };
      const auditEntries: any[] = [];
      const office = corrReq.session.office;

      if ((corrReq.requestType === "check_in" || corrReq.requestType === "both") && corrReq.intendedCheckIn) {
        auditEntries.push({
          sessionId: corrReq.session.id,
          adminId: admin.id,
          field: "checkInAt",
          oldValue: corrReq.session.checkInAt ? corrReq.session.checkInAt.toISOString() : null,
          newValue: corrReq.intendedCheckIn.toISOString(),
          note: `Approved correction request ${corrReq.id}`,
        });
        sessionUpdate.checkInAt = corrReq.intendedCheckIn;

        if (office?.workStartTime) {
          const late = calcLateMinutes(corrReq.intendedCheckIn, office.workStartTime, office.timezone ?? "UTC");
          sessionUpdate.isLateArrival = late > 0;
          sessionUpdate.minutesLate = late > 0 ? late : null;
        }
      }

      if ((corrReq.requestType === "check_out" || corrReq.requestType === "both") && corrReq.intendedCheckOut) {
        auditEntries.push({
          sessionId: corrReq.session.id,
          adminId: admin.id,
          field: "checkOutAt",
          oldValue: corrReq.session.checkOutAt ? corrReq.session.checkOutAt.toISOString() : null,
          newValue: corrReq.intendedCheckOut.toISOString(),
          note: `Approved correction request ${corrReq.id}`,
        });
        sessionUpdate.checkOutAt = corrReq.intendedCheckOut;

        if (office?.workEndTime) {
          const endParts = office.workEndTime.split(":").map(Number);
          const endHour = endParts[0] ?? 17;
          const endMin = endParts[1] ?? 0;
          const checkOut = corrReq.intendedCheckOut;
          const outHour = checkOut.getHours();
          const outMin = checkOut.getMinutes();
          const isEarly = outHour < endHour || (outHour === endHour && outMin < endMin);
          sessionUpdate.isEarlyDeparture = isEarly;
        }
      }

      ops.push(
        prisma.attendanceSession.update({ where: { id: corrReq.session.id }, data: sessionUpdate }),
        ...auditEntries.map((e) => prisma.attendanceAuditLog.create({ data: e }))
      );
    } else {
      const officeId = corrReq.user.officeId;
      const office = officeId
        ? await prisma.office.findUnique({ where: { id: officeId } })
        : await prisma.office.findFirst({ where: { isActive: true } });

      if (office) {
        const newSessionData: Record<string, any> = {
          userId: corrReq.userId,
          officeId: office.id,
          workDate: corrReq.workDate,
          status: "corrected",
          checkInAt: corrReq.intendedCheckIn ?? undefined,
          checkOutAt: corrReq.intendedCheckOut ?? undefined,
        };

        if (corrReq.intendedCheckIn && office.workStartTime) {
          const late = calcLateMinutes(corrReq.intendedCheckIn, office.workStartTime, office.timezone ?? "UTC");
          newSessionData.isLateArrival = late > 0;
          newSessionData.minutesLate = late > 0 ? late : null;
        }

        if (corrReq.intendedCheckOut && office.workEndTime) {
          const endParts = office.workEndTime.split(":").map(Number);
          const endHour = endParts[0] ?? 17;
          const endMin = endParts[1] ?? 0;
          const checkOut = corrReq.intendedCheckOut;
          const isEarly = checkOut.getHours() < endHour || (checkOut.getHours() === endHour && checkOut.getMinutes() < endMin);
          newSessionData.isEarlyDeparture = isEarly;
        }

        ops.push(prisma.attendanceSession.create({ data: newSessionData }));
      }
    }
  }

  await prisma.$transaction(ops);

  await notifyUser({
    userId: corrReq.userId,
    type: "correction_decided",
    title: `Your attendance correction was ${parsed.data.status}`,
    body: `${corrReq.requestType.replace("_", " ")} · ${corrReq.workDate.toISOString().slice(0, 10)}`,
    link: "/employee/history",
  });

  logActivity(
    admin.id,
    `correction_${parsed.data.status}`,
    "admin",
    `Correction ${parsed.data.status} for ${corrReq.user.name} · ${corrReq.requestType.replace("_", " ")} · ${corrReq.workDate.toISOString().slice(0, 10)}`,
  ).catch(() => null);

  return NextResponse.json({ success: true });
}
