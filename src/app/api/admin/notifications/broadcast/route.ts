import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "../../../../../lib/apiAuth";
import { notifyAll, notifyRole } from "../../../../../lib/notify";

const BodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(2000).optional().nullable(),
  link: z.string().trim().max(500).optional().nullable(),
  audience: z.enum(["all", "admin", "manager", "employee"]).default("all"),
});

export async function POST(req: Request) {
  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const data = {
    type: "broadcast" as const,
    title: parsed.data.title.trim(),
    body: parsed.data.body?.trim() || null,
    link: parsed.data.link?.trim() || null,
  };

  const sent =
    parsed.data.audience === "all"
      ? await notifyAll(data)
      : await notifyRole(parsed.data.audience, data);

  return NextResponse.json({ sent });
}
