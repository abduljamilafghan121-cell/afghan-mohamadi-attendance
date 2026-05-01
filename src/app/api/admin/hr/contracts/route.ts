import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../../lib/auth";
import { logActivity } from "../../../../../lib/activityLog";

async function getAdmin(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const user = await verifyAccessToken(token);
  assertRole(user, ["admin"]);
  return user;
}

const ContractSchema = z.object({
  userId: z.string().min(1),
  contractType: z.enum(["full_time", "part_time", "contract", "intern"]).default("full_time"),
  startDate: z.string(),
  endDate: z.string().optional().nullable(),
  probationEndDate: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  salary: z.number().min(0).optional().nullable(),
  currency: z.string().default("AFN"),
  payFrequency: z.enum(["monthly", "biweekly", "weekly"]).default("monthly"),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export async function GET(req: Request) {
  try { await getAdmin(req); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const where = userId ? { userId } : {};
  const contracts = await prisma.employeeContract.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true, department: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ contracts });
}

export async function POST(req: Request) {
  let admin;
  try { admin = await getAdmin(req); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
  const body = ContractSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data = body.data;
  const contract = await prisma.employeeContract.create({
    data: {
      userId: data.userId,
      contractType: data.contractType,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      probationEndDate: data.probationEndDate ? new Date(data.probationEndDate) : null,
      jobTitle: data.jobTitle ?? null,
      department: data.department ?? null,
      salary: data.salary ?? null,
      currency: data.currency,
      payFrequency: data.payFrequency,
      notes: data.notes ?? null,
      isActive: data.isActive,
      createdById: admin.id,
    },
  });
  logActivity(admin.id, "create_contract", "hr", `Created contract for user ${data.userId}`).catch(() => null);
  return NextResponse.json({ contract }, { status: 201 });
}

export async function PATCH(req: Request) {
  let admin;
  try { admin = await getAdmin(req); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
  const body = ContractSchema.partial().extend({ id: z.string() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { id, ...rest } = body.data;
  const contract = await prisma.employeeContract.update({
    where: { id },
    data: {
      ...rest,
      startDate: rest.startDate ? new Date(rest.startDate) : undefined,
      endDate: rest.endDate ? new Date(rest.endDate) : rest.endDate,
      probationEndDate: rest.probationEndDate ? new Date(rest.probationEndDate) : rest.probationEndDate,
    },
  });
  logActivity(admin.id, "update_contract", "hr", `Updated contract ${id}`).catch(() => null);
  return NextResponse.json({ contract });
}

export async function DELETE(req: Request) {
  let admin;
  try { admin = await getAdmin(req); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.employeeContract.delete({ where: { id } });
  logActivity(admin.id, "delete_contract", "hr", `Deleted contract ${id}`).catch(() => null);
  return NextResponse.json({ ok: true });
}
