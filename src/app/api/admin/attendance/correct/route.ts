import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../../lib/auth";

const BodySchema = z.object({
  sessionId: z.string().min(1),
  checkInAt: z.string().optional().nullable(),
  checkOutAt: z.string().optional().nullable(),
  note: z.string().optional(),
});

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

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const session = await prisma.attendanceSession.findUnique({
    where: { id: parsed.data.sessionId },
    select: { id: true, checkInAt: true, checkOutAt: true },
  });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const newCheckIn = parsed.data.checkInAt ? new Date(parsed.data.checkInAt) : undefined;
  const newCheckOut = parsed.data.checkOutAt ? new Date(parsed.data.checkOutAt) : undefined;

  if (newCheckIn && isNaN(newCheckIn.getTime())) {
    return NextResponse.json({ error: "Invalid checkInAt" }, { status: 400 });
  }
  if (newCheckOut && isNaN(newCheckOut.getTime())) {
    return NextResponse.json({ error: "Invalid checkOutAt" }, { status: 400 });
  }

  const auditEntries: { field: string; oldValue: string | null; newValue: string | null; note: string | null }[] = [];

  if (newCheckIn !== undefined) {
    auditEntries.push({
      field: "checkInAt",
      oldValue: session.checkInAt ? session.checkInAt.toISOString() : null,
      newValue: newCheckIn.toISOString(),
      note: parsed.data.note ?? null,
    });
  }
  if (newCheckOut !== undefined) {
    auditEntries.push({
      field: "checkOutAt",
      oldValue: session.checkOutAt ? session.checkOutAt.toISOString() : null,
      newValue: newCheckOut.toISOString(),
      note: parsed.data.note ?? null,
    });
  }

  const [updatedSession] = await prisma.$transaction([
    prisma.attendanceSession.update({
      where: { id: session.id },
      data: {
        ...(newCheckIn !== undefined ? { checkInAt: newCheckIn } : {}),
        ...(newCheckOut !== undefined ? { checkOutAt: newCheckOut } : {}),
        status: "corrected",
      },
      select: { id: true, checkInAt: true, checkOutAt: true, status: true },
    }),
    ...auditEntries.map((entry) =>
      prisma.attendanceAuditLog.create({
        data: {
          sessionId: session.id,
          adminId: admin.id,
          field: entry.field,
          oldValue: entry.oldValue,
          newValue: entry.newValue,
          note: entry.note,
        },
      })
    ),
  ]);

  return NextResponse.json({ session: updatedSession });
}
