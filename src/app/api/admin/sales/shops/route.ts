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
  // When `includeInactive=1` is passed, the admin Customers screen also gets
  // back deactivated shops so they can be edited / re-activated.
  const includeInactive = url.searchParams.get("includeInactive") === "1";

  const shops = await prisma.shop.findMany({
    where: {
      ...(includeInactive ? {} : { isActive: true }),
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
      ...(regionId === "none" ? { regionId: null } : regionId ? { regionId } : {}),
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    take: 500,
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      isActive: true,
      regionId: true,
      region: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ shops });
}

// Admin-only customer edit. Every field is optional so the same endpoint can
// be used for region-only assignment (existing behaviour) or full profile edit.
const PatchSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(200).optional(),
  address: z.string().trim().max(500).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  regionId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const body = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { id, name, address, phone, regionId, isActive } = body.data;

  const shop = await prisma.shop.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(address !== undefined ? { address: address || null } : {}),
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(regionId !== undefined ? { regionId } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      isActive: true,
      regionId: true,
      region: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ shop });
}
