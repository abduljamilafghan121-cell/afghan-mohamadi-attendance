import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../../../lib/prisma";
import { getBearerToken, verifyAccessToken } from "../../../lib/auth";

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  employeeId: true,
  phone: true,
  department: true,
  jobTitle: true,
  address: true,
  photoUrl: true,
  isActive: true,
  createdAt: true,
};

async function getAuth(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) throw new Error("Unauthorized");
  return verifyAccessToken(token);
}

export async function GET(req: Request) {
  let authUser;
  try {
    authUser = await getAuth(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: authUser.id }, select: userSelect });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ user });
}

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional(),
});

export async function PATCH(req: Request) {
  let authUser;
  try {
    authUser = await getAuth(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { name, phone, address, currentPassword, newPassword } = body.data;

  const updateData: Record<string, any> = {};
  if (name !== undefined) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone || null;
  if (address !== undefined) updateData.address = address || null;

  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required to set a new one" }, { status: 400 });
    }
    const dbUser = await prisma.user.findUnique({ where: { id: authUser.id }, select: { passwordHash: true } });
    if (!dbUser) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const valid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
    if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    updateData.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: authUser.id },
    data: updateData,
    select: userSelect,
  });

  return NextResponse.json({ user });
}
