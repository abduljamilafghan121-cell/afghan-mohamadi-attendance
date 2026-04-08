import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../lib/auth";

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["employee", "manager", "admin"]).default("employee"),
  managerId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  employeeId: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  department: z.string().min(1).optional(),
  jobTitle: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  photoUrl: z.string().min(1).optional(),
});

export async function GET(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await verifyAccessToken(token);
    assertRole(user, ["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      managerId: true,
      employeeId: true,
      phone: true,
      department: true,
      jobTitle: true,
      address: true,
      photoUrl: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let authUser;
  try {
    authUser = await verifyAccessToken(token);
    assertRole(authUser, ["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = CreateUserSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (body.data.managerId && body.data.managerId === authUser.id) {
    return NextResponse.json({ error: "managerId cannot be self" }, { status: 400 });
  }

  if (body.data.managerId) {
    const manager = await prisma.user.findUnique({ where: { id: body.data.managerId } });
    if (!manager) {
      return NextResponse.json({ error: "managerId not found" }, { status: 400 });
    }
  }

  const passwordHash = await bcrypt.hash(body.data.password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        name: body.data.name,
        email: body.data.email,
        passwordHash,
        role: body.data.role,
        managerId: body.data.managerId,
        isActive: body.data.isActive ?? true,
        employeeId: body.data.employeeId,
        phone: body.data.phone,
        department: body.data.department,
        jobTitle: body.data.jobTitle,
        address: body.data.address,
        photoUrl: body.data.photoUrl,
      } as any,
      select: { id: true, name: true, email: true, role: true, isActive: true, managerId: true },
    });

    return NextResponse.json({ user });
  } catch (e: any) {
    if (String(e?.code) === "P2002") {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
