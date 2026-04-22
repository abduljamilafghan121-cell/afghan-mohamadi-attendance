import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";
import { requireUser } from "../../../../../lib/apiAuth";

export async function GET(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const regionId = url.searchParams.get("regionId");

  const shops = await prisma.shop.findMany({
    where: {
      isActive: true,
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
      ...(regionId === "none" ? { regionId: null } : regionId ? { regionId } : {}),
    },
    orderBy: { name: "asc" },
    take: 500,
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      regionId: true,
      region: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ shops });
}

const PatchSchema = z.object({
  id: z.string().min(1),
  regionId: z.string().nullable().optional(),
});

export async function PATCH(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const body = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const shop = await prisma.shop.update({
    where: { id: body.data.id },
    data: {
      ...(body.data.regionId !== undefined ? { regionId: body.data.regionId } : {}),
    },
    select: {
      id: true,
      name: true,
      regionId: true,
      region: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ shop });
}
