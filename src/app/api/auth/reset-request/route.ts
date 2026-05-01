import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "../../../../lib/prisma";
import { requireUser } from "../../../../lib/apiAuth";
import { logActivity } from "../../../../lib/activityLog";
import { checkRateLimit } from "../../../../lib/rateLimit";

const BodySchema = z.object({
  userId: z.string().min(1),
});

export async function POST(req: Request) {
  // Rate limit: 10 reset-link generations per admin per minute
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`reset-request:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before generating another link." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const auth = await requireUser(req, ["admin"]);
  if (!auth.ok) return auth.response;

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: body.data.userId },
    select: { id: true, name: true, isActive: true },
  });

  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Invalidate any existing unused tokens for this user
  await prisma.passwordResetToken.deleteMany({
    where: { userId: target.id, usedAt: null },
  });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: { userId: target.id, tokenHash, expiresAt },
  });

  logActivity(
    auth.user.id,
    "reset_link_generated",
    "admin",
    `Generated password reset link for ${target.name}`,
  ).catch(() => null);

  const resetPath = `/reset-password?token=${rawToken}`;

  return NextResponse.json({ resetPath });
}
