import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { requireUser } from "../../../../lib/apiAuth";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";

  const shops = await prisma.shop.findMany({
    where: {
      isActive: true,
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { name: "asc" },
    take: 200,
    select: { id: true, name: true, address: true, phone: true },
  });

  return NextResponse.json({ shops });
}

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  gpsLat: z.number().optional().nullable(),
  gpsLng: z.number().optional().nullable(),
});

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const body = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const shop = await prisma.shop.create({
    data: {
      name: body.data.name.trim(),
      address: body.data.address ?? null,
      phone: body.data.phone ?? null,
      gpsLat: body.data.gpsLat ?? null,
      gpsLng: body.data.gpsLng ?? null,
      createdById: auth.user.id,
    },
    select: { id: true, name: true, address: true, phone: true },
  });

  return NextResponse.json({ shop });
}
