import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../lib/auth";

const BodySchema = z.object({
  title: z.string().min(1),
  logoUrl: z.string().min(1).optional(),
  carryOverEnabled: z.boolean().optional(),
  carryOverMaxDays: z.number().int().min(0).nullable().optional(),
});

export async function GET(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await verifyAccessToken(token);
    assertRole(user, ["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const org = await prisma.organization.findUnique({
    where: { key: "primary" },
    select: { id: true, key: true, title: true, logoUrl: true, carryOverEnabled: true, carryOverMaxDays: true, updatedAt: true },
  });

  return NextResponse.json({ org });
}

export async function POST(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await verifyAccessToken(token);
    assertRole(user, ["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const org = await prisma.organization.upsert({
    where: { key: "primary" },
    create: {
      key: "primary",
      title: body.data.title,
      logoUrl: body.data.logoUrl,
      carryOverEnabled: body.data.carryOverEnabled ?? true,
      carryOverMaxDays: body.data.carryOverMaxDays ?? null,
    },
    update: {
      title: body.data.title,
      logoUrl: body.data.logoUrl,
      ...(body.data.carryOverEnabled !== undefined && { carryOverEnabled: body.data.carryOverEnabled }),
      ...(body.data.carryOverMaxDays !== undefined && { carryOverMaxDays: body.data.carryOverMaxDays }),
    },
    select: { id: true, key: true, title: true, logoUrl: true, carryOverEnabled: true, carryOverMaxDays: true, updatedAt: true },
  });

  return NextResponse.json({ org });
}
