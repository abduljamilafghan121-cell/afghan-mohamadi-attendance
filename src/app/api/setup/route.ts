import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";

const BodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function GET() {
  const existingAdmins = await prisma.user.count({ where: { role: "admin" } });
  return NextResponse.json({ setupNeeded: existingAdmins === 0 });
}

export async function POST(req: Request) {
  const existingAdmins = await prisma.user.count({ where: { role: "admin" } });
  if (existingAdmins > 0) {
    return NextResponse.json(
      { error: "Setup already completed" },
      { status: 400 },
    );
  }

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(body.data.password, 10);
  const user = await prisma.user.create({
    data: {
      name: body.data.name,
      email: body.data.email,
      passwordHash,
      role: "admin",
      isActive: true,
    },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json({ user });
}
