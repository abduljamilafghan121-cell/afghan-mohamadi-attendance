import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../../lib/auth";
import { logActivity } from "../../../../../lib/activityLog";

async function getAdmin(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const user = await verifyAccessToken(token);
  assertRole(user, ["admin"]);
  return user;
}

const TrainingSchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(1),
  provider: z.string().optional().nullable(),
  startDate: z.string(),
  endDate: z.string().optional().nullable(),
  status: z.enum(["planned", "in_progress", "completed", "cancelled"]).default("planned"),
  certificate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: Request) {
  try { await getAdmin(req); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
  const userId = new URL(req.url).searchParams.get("userId");
  const records = await prisma.trainingRecord.findMany({
    where: userId ? { userId } : {},
    include: { user: { select: { id: true, name: true, department: true } } },
    orderBy: { startDate: "desc" },
  });
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, department: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ records, users });
}

export async function POST(req: Request) {
  let admin;
  try { admin = await getAdmin(req); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
  const body = TrainingSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const d = body.data;
  const record = await prisma.trainingRecord.create({
    data: {
      ...d,
      startDate: new Date(d.startDate),
      endDate: d.endDate ? new Date(d.endDate) : null,
      createdById: admin.id,
    },
  });
  logActivity(admin.id, "create_training", "hr", `Training record for ${d.userId}: ${d.title}`).catch(() => null);
  return NextResponse.json({ record }, { status: 201 });
}

export async function PATCH(req: Request) {
  let admin;
  try { admin = await getAdmin(req); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
  const body = TrainingSchema.partial().extend({ id: z.string() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { id, ...rest } = body.data;
  const record = await prisma.trainingRecord.update({
    where: { id },
    data: {
      ...rest,
      startDate: rest.startDate ? new Date(rest.startDate) : undefined,
      endDate: rest.endDate ? new Date(rest.endDate) : rest.endDate,
    },
  });
  logActivity(admin.id, "update_training", "hr", `Updated training ${id}`).catch(() => null);
  return NextResponse.json({ record });
}

export async function DELETE(req: Request) {
  let admin;
  try { admin = await getAdmin(req); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.trainingRecord.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
