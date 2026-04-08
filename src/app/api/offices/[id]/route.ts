import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../lib/auth";

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  gpsLat: z.number().optional(),
  gpsLng: z.number().optional(),
  gpsRadiusM: z.number().int().positive().optional(),
  timezone: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  weeklyOffDays: z.array(z.number().int().min(0).max(6)).optional(),
  workStartTime: z.string().regex(/^\d{1,2}:\d{2}$/).optional().nullable(),
  workEndTime: z.string().regex(/^\d{1,2}:\d{2}$/).optional().nullable(),
});

async function getAuthAdmin(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  try {
    const user = await verifyAccessToken(token);
    assertRole(user, ["admin"]);
    return user;
  } catch {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await getAuthAdmin(req);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 403 });
  }

  const office = await prisma.office.findUnique({ where: { id: params.id } });
  if (!office) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const updated = await prisma.office.update({
    where: { id: params.id },
    data: parsed.data,
  });

  return NextResponse.json({ office: updated });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await getAuthAdmin(req);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 403 });
  }

  const office = await prisma.office.findUnique({ where: { id: params.id } });
  if (!office) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.office.update({ where: { id: params.id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
