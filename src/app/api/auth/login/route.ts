import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { signAccessToken } from "../../../../lib/auth";
import { logActivity } from "../../../../lib/activityLog";
import { checkRateLimit } from "../../../../lib/rateLimit";

const BodySchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const { allowed, retryAfterMs } = checkRateLimit(`login:${ip}`, 5, 60_000);
  if (!allowed) {
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    return NextResponse.json(
      { error: "Too many login attempts. Please wait before trying again." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) },
      },
    );
  }

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: body.data.email },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const ok = await bcrypt.compare(body.data.password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await signAccessToken({ id: user.id, role: user.role }, body.data.rememberMe);

  logActivity(user.id, "login", "auth", `Logged in`).catch(() => null);

  return NextResponse.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}
