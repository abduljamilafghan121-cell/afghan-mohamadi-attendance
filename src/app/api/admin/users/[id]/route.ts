import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../../lib/auth";

async function getAuthAdmin(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  try {
    const user = await verifyAccessToken(token);
    assertRole(user, ["admin"]);
    return user;
  } catch {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
}

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(["employee", "manager", "admin"]).optional(),
  isActive: z.boolean().optional(),
  employeeId: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  managerId: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
});

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await getAuthAdmin(req);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, email: true, role: true, isActive: true,
      managerId: true, employeeId: true, phone: true, department: true,
      jobTitle: true, address: true, photoUrl: true, createdAt: true,
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ user });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let authUser;
  try {
    authUser = await getAuthAdmin(req);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }

  const body = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body", details: body.error.flatten() }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (body.data.managerId && body.data.managerId === params.id) {
    return NextResponse.json({ error: "managerId cannot be self" }, { status: 400 });
  }

  if (body.data.managerId) {
    const manager = await prisma.user.findUnique({ where: { id: body.data.managerId } });
    if (!manager) return NextResponse.json({ error: "Manager not found" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.data.name !== undefined) updateData.name = body.data.name;
  if (body.data.email !== undefined) updateData.email = body.data.email;
  if (body.data.role !== undefined) updateData.role = body.data.role;
  if (body.data.isActive !== undefined) updateData.isActive = body.data.isActive;
  if (body.data.employeeId !== undefined) updateData.employeeId = body.data.employeeId || null;
  if (body.data.phone !== undefined) updateData.phone = body.data.phone || null;
  if (body.data.department !== undefined) updateData.department = body.data.department || null;
  if (body.data.jobTitle !== undefined) updateData.jobTitle = body.data.jobTitle || null;
  if (body.data.address !== undefined) updateData.address = body.data.address || null;
  if (body.data.managerId !== undefined) updateData.managerId = body.data.managerId || null;
  if (body.data.photoUrl !== undefined) updateData.photoUrl = body.data.photoUrl || null;
  if (body.data.password) {
    updateData.passwordHash = await bcrypt.hash(body.data.password, 10);
  }

  try {
    const updated = await prisma.user.update({
      where: { id: params.id },
      data: updateData as any,
      select: {
        id: true, name: true, email: true, role: true, isActive: true,
        managerId: true, employeeId: true, phone: true, department: true,
        jobTitle: true, address: true, photoUrl: true,
      },
    });
    return NextResponse.json({ user: updated });
  } catch (e: any) {
    if (String(e?.code) === "P2002") {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  let authUser;
  try {
    authUser = await getAuthAdmin(req);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }

  if (params.id === authUser.id) {
    return NextResponse.json({ error: "Cannot deactivate your own account" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (target.role === "admin") {
    return NextResponse.json({ error: "Cannot deactivate admin accounts" }, { status: 403 });
  }

  try {
    await prisma.user.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return NextResponse.json({ deleted: true });
  } catch (e: any) {
    console.error("Deactivate user error:", e);
    return NextResponse.json({ error: "Failed to deactivate user" }, { status: 500 });
  }
}
