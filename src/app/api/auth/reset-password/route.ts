import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../../../lib/prisma";
import { checkRateLimit } from "../../../../lib/rateLimit";
import { logActivity } from "../../../../lib/activityLog";

const ValidateSchema = z.object({
  token: z.string().min(1),
});

const ResetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
});

// GET /api/auth/reset-password?token=... — validate token, return user name
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("token") ?? "";

  const parsed = ValidateSchema.safeParse({ token: raw });
  if (!parsed.success) {
    return NextResponse.json({ valid: false, error: "Invalid token" }, { status: 400 });
  }

  const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { name: true, isActive: true } } },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json(
      { valid: false, error: "This reset link is invalid or has expired." },
      { status: 400 },
    );
  }

  return NextResponse.json({ valid: true, userName: record.user.name });
}

// POST /api/auth/reset-password — consume token and set new password
export async function POST(req: Request) {
  // Rate limit: 5 attempts per IP per 15 minutes to prevent brute-force
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`reset-password:${ip}`, 5, 15 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const body = ResetSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const tokenHash = crypto.createHash("sha256").update(body.data.token).digest("hex");

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, name: true, isActive: true } } },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired." },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(body.data.password, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  // Audit log: record that the reset link was successfully used
  logActivity(
    record.userId,
    "password_reset",
    "auth",
    `Password was reset via a reset link for ${record.user.name}`,
  ).catch(() => null);

  return NextResponse.json({ success: true });
}
