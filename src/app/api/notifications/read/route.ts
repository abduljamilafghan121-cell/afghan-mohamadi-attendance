import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { requireUser } from "../../../../lib/apiAuth";

const BodySchema = z.object({
  id: z.string().min(1).optional(),
  ids: z.array(z.string().min(1)).optional(),
  all: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const now = new Date();
  let where: any;

  if (parsed.data.all) {
    where = { userId: auth.user.id, isRead: false };
  } else if (parsed.data.ids && parsed.data.ids.length > 0) {
    where = { userId: auth.user.id, id: { in: parsed.data.ids }, isRead: false };
  } else if (parsed.data.id) {
    where = { userId: auth.user.id, id: parsed.data.id, isRead: false };
  } else {
    return NextResponse.json({ error: "Provide id, ids or all=true" }, { status: 400 });
  }

  const res = await prisma.notification.updateMany({
    where,
    data: { isRead: true, readAt: now },
  });

  return NextResponse.json({ updated: res.count });
}
