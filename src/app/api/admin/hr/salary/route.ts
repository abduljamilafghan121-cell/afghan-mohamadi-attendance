import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../../lib/auth";
import { logActivity } from "../../../../../lib/activityLog";
import { notifyUser } from "../../../../../lib/notify";

async function getAdmin(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const user = await verifyAccessToken(token);
  assertRole(user, ["admin"]);
  return user;
}

const SalarySchema = z.object({
  userId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  baseSalary: z.number().min(0),
  allowances: z.number().min(0).default(0),
  deductions: z.number().min(0).default(0),
  currency: z.string().default("AFN"),
  payFrequency: z.enum(["monthly", "biweekly", "weekly"]).default("monthly"),
  notes: z.string().optional().nullable(),
  paidAt: z.string().optional().nullable(),
});

export async function GET(req: Request) {
  try { await getAdmin(req); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const year = searchParams.get("year");

  const where: any = {};
  if (userId) where.userId = userId;
  if (year) where.year = parseInt(year, 10);

  const records = await prisma.salaryRecord.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, department: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  // Also get all users for the selector
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, department: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ records, users });
}

export async function POST(req: Request) {
  let admin;
  try { admin = await getAdmin(req); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
  const body = SalarySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const d = body.data;
  const netSalary = d.baseSalary + d.allowances - d.deductions;

  const record = await prisma.salaryRecord.upsert({
    where: { userId_month_year: { userId: d.userId, month: d.month, year: d.year } },
    create: {
      userId: d.userId, month: d.month, year: d.year,
      baseSalary: d.baseSalary, allowances: d.allowances,
      deductions: d.deductions, netSalary,
      currency: d.currency, payFrequency: d.payFrequency,
      notes: d.notes ?? null,
      paidAt: d.paidAt ? new Date(d.paidAt) : null,
      createdById: admin.id,
    },
    update: {
      baseSalary: d.baseSalary, allowances: d.allowances,
      deductions: d.deductions, netSalary,
      currency: d.currency, payFrequency: d.payFrequency,
      notes: d.notes ?? null,
      paidAt: d.paidAt ? new Date(d.paidAt) : null,
    },
  });

  logActivity(admin.id, "upsert_salary", "hr", `Salary record for ${d.userId} ${d.month}/${d.year}`).catch(() => null);

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const monthName = monthNames[(d.month - 1)] ?? String(d.month);
  notifyUser({
    userId: d.userId,
    type: "salary_recorded",
    title: d.paidAt
      ? `Your salary for ${monthName} ${d.year} has been paid`
      : `Salary record updated — ${monthName} ${d.year}`,
    body: `Net salary: ${record.currency} ${record.netSalary.toLocaleString()}${d.notes ? ` · ${d.notes}` : ""}`,
    link: "/profile",
  }).catch(() => null);

  return NextResponse.json({ record });
}

export async function DELETE(req: Request) {
  let admin;
  try { admin = await getAdmin(req); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.salaryRecord.delete({ where: { id } });
  logActivity(admin.id, "delete_salary", "hr", `Deleted salary record ${id}`).catch(() => null);
  return NextResponse.json({ ok: true });
}
