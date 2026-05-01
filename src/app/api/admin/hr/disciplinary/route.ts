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

const Schema = z.object({
  userId: z.string().min(1),
  type: z.enum(["verbal_warning", "written_warning", "final_warning", "suspension", "termination"]),
  date: z.string(),
  reason: z.string().min(1),
  description: z.string().optional().nullable(),
  actionTaken: z.string().optional().nullable(),
  issuedById: z.string().optional().nullable(),
});

export async function GET(req: Request) {
  try { await getAdmin(req); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
  const userId = new URL(req.url).searchParams.get("userId");
  const records = await prisma.disciplinaryRecord.findMany({
    where: userId ? { userId } : {},
    include: {
      user: { select: { id: true, name: true, department: true } },
      issuedBy: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
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
  const body = Schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const d = body.data;
  const record = await prisma.disciplinaryRecord.create({
    data: { ...d, date: new Date(d.date), issuedById: d.issuedById ?? admin.id },
  });
  logActivity(admin.id, "create_disciplinary", "hr", `Disciplinary record for ${d.userId}: ${d.type}`).catch(() => null);
  return NextResponse.json({ record }, { status: 201 });
}

export async function PATCH(req: Request) {
  let admin;
  try { admin = await getAdmin(req); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
  const body = Schema.partial().extend({ id: z.string() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { id, ...rest } = body.data;
  const record = await prisma.disciplinaryRecord.update({
    where: { id },
    data: { ...rest, date: rest.date ? new Date(rest.date) : undefined },
  });
  return NextResponse.json({ record });
}

export async function DELETE(req: Request) {
  let admin;
  try { admin = await getAdmin(req); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.disciplinaryRecord.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
