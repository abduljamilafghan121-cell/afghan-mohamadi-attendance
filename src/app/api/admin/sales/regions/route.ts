import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";
import { requireUser } from "../../../../../lib/apiAuth";

export async function GET(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const regions = await prisma.region.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { shops: true } } },
  });
  return NextResponse.json({
    regions: regions.map((r) => ({
      id: r.id,
      name: r.name,
      isActive: r.isActive,
      shopCount: r._count.shops,
      createdAt: r.createdAt,
    })),
  });
}

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function POST(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const body = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  try {
    const region = await prisma.region.create({
      data: { name: body.data.name.trim() },
    });
    return NextResponse.json({ region });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "A region with that name already exists" }, { status: 409 });
    }
    throw e;
  }
}

const PatchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const body = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  try {
    const region = await prisma.region.update({
      where: { id: body.data.id },
      data: {
        ...(body.data.name !== undefined ? { name: body.data.name.trim() } : {}),
        ...(body.data.isActive !== undefined ? { isActive: body.data.isActive } : {}),
      },
    });
    return NextResponse.json({ region });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "A region with that name already exists" }, { status: 409 });
    }
    if (e?.code === "P2025") {
      return NextResponse.json({ error: "Region not found" }, { status: 404 });
    }
    throw e;
  }
}

export async function DELETE(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Soft delete: deactivate so existing shops keep their region history
  await prisma.region.update({ where: { id }, data: { isActive: false } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
