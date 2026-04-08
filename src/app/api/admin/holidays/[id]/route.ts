import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../../lib/auth";

async function getAdmin(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const user = await verifyAccessToken(token);
  assertRole(user, ["admin"]);
  return user;
}

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await getAdmin(req);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 403 });
  }

  const holiday = await prisma.holiday.findUnique({ where: { id: params.id } });
  if (!holiday) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const updateData: any = {};
  if (body.data.name) updateData.name = body.data.name;
  if (body.data.date) {
    const [y, m, d] = body.data.date.split("-").map(Number);
    updateData.date = new Date(Date.UTC(y, m - 1, d));
  }

  const updated = await prisma.holiday.update({ where: { id: params.id }, data: updateData });
  return NextResponse.json({ holiday: updated });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await getAdmin(req);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 403 });
  }

  const holiday = await prisma.holiday.findUnique({ where: { id: params.id } });
  if (!holiday) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.holiday.delete({ where: { id: params.id } });
  return NextResponse.json({ deleted: true });
}
