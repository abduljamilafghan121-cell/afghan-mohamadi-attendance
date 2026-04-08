import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../lib/auth";

async function getAdmin(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const user = await verifyAccessToken(token);
  assertRole(user, ["admin"]);
  return user;
}

export async function GET(req: Request) {
  try {
    await getAdmin(req);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 403 });
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? undefined;
  const month = url.searchParams.get("month");

  const where: any = {};
  if (userId) where.userId = userId;
  if (month) {
    const [y, m] = month.split("-").map(Number);
    where.date = {
      gte: new Date(Date.UTC(y, m - 1, 1)),
      lt: new Date(Date.UTC(y, m, 1)),
    };
  }

  const overrides = await prisma.workdayOverride.findMany({
    where,
    orderBy: { date: "asc" },
    select: {
      id: true,
      userId: true,
      date: true,
      isOvertime: true,
      note: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ overrides });
}

const CreateSchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  isOvertime: z.boolean().default(true),
  note: z.string().optional(),
});

export async function POST(req: Request) {
  let admin;
  try {
    admin = await getAdmin(req);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 403 });
  }

  const body = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({ where: { id: body.data.userId } });
  if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const [y, m, d] = body.data.date.split("-").map(Number);
  const dateUtc = new Date(Date.UTC(y, m - 1, d));

  try {
    const override = await prisma.workdayOverride.upsert({
      where: { userId_date: { userId: body.data.userId, date: dateUtc } },
      update: { isOvertime: body.data.isOvertime, note: body.data.note ?? null, createdById: admin.id },
      create: {
        userId: body.data.userId,
        date: dateUtc,
        isOvertime: body.data.isOvertime,
        note: body.data.note ?? null,
        createdById: admin.id,
      },
    });
    return NextResponse.json({ override });
  } catch (e: any) {
    throw e;
  }
}

export async function DELETE(req: Request) {
  try {
    await getAdmin(req);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 403 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const override = await prisma.workdayOverride.findUnique({ where: { id } });
  if (!override) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.workdayOverride.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
