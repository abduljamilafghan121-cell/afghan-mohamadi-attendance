import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../lib/auth";
import { notifyUser } from "../../../../lib/notify";

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
    include: { session: true, user: true },
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
      }

      ops.push(
        prisma.attendanceSession.update({ where: { id: corrReq.session.id }, data: sessionUpdate }),
        ...auditEntries.map((e) => prisma.attendanceAuditLog.create({ data: e }))
      );
    } else {
      const firstOffice = await prisma.office.findFirst({ where: { isActive: true } });
      if (firstOffice) {
        ops.push(
          prisma.attendanceSession.create({
            data: {
              userId: corrReq.userId,
              officeId: firstOffice.id,
              workDate: corrReq.workDate,
              status: "corrected",
              checkInAt: corrReq.intendedCheckIn ?? undefined,
              checkOutAt: corrReq.intendedCheckOut ?? undefined,
            },
          })
        );
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

  return NextResponse.json({ success: true });
}
