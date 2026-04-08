import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../lib/auth";

const CreateOfficeSchema = z.object({
  name: z.string().min(1),
  gpsLat: z.number(),
  gpsLng: z.number(),
  gpsRadiusM: z.number().int().positive(),
  timezone: z.string().min(1).default("UTC"),
  weeklyOffDays: z.array(z.number().int().min(0).max(6)).optional(),
  workStartTime: z.string().regex(/^\d{1,2}:\d{2}$/).optional().nullable(),
  workEndTime: z.string().regex(/^\d{1,2}:\d{2}$/).optional().nullable(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "true";
  const offices = await prisma.office.findMany({
    where: all ? {} : { isActive: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ offices });
}

export async function POST(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let user;
  try {
    user = await verifyAccessToken(token);
    assertRole(user, ["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = CreateOfficeSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const office = await prisma.office.create({ data: body.data });
  return NextResponse.json({ office });
}
