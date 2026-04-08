import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../lib/auth";

const LEAVE_TYPES = ["annual", "sick", "casual", "unpaid"] as const;

const UpsertSchema = z.object({
  userId: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  leaveType: z.enum(["annual", "sick", "casual", "unpaid"]),
  entitlementDays: z.number().min(0).max(365),
  notes: z.string().optional(),
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

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, employeeId: true, department: true },
    orderBy: { name: "asc" },
  });

  if (!userId) {
    return NextResponse.json({ users, balances: [], year });
  }

  const rows = await prisma.leaveBalance.findMany({
    where: { userId, year },
  });

  const balances = LEAVE_TYPES.map((type) => {
    const row = rows.find((r) => r.leaveType === type);
    const entitlementDays = row?.entitlementDays ?? 0;
    const carriedOverDays = row?.carriedOverDays ?? 0;
    const usedDays = row?.usedDays ?? 0;
    return {
      id: row?.id ?? null,
      leaveType: type,
      entitlementDays,
      carriedOverDays,
      usedDays,
      remainingDays: Math.max(0, entitlementDays + carriedOverDays - usedDays),
      notes: row?.notes ?? null,
    };
  });

  return NextResponse.json({ users, balances, year });
}

export async function POST(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await verifyAccessToken(token);
    assertRole(user, ["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = UpsertSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { userId, year, leaveType, entitlementDays, notes } = body.data;

  const userExists = await prisma.user.findUnique({ where: { id: userId } });
  if (!userExists) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const balance = await prisma.leaveBalance.upsert({
    where: { userId_year_leaveType: { userId, year, leaveType } },
    create: { userId, year, leaveType, entitlementDays, notes: notes ?? null },
    update: { entitlementDays, notes: notes ?? null },
  });

  return NextResponse.json({ balance });
}
