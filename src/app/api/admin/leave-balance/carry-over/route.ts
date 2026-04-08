import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../../lib/auth";

const BodySchema = z.object({
  fromYear: z.number().int().min(2000).max(2100),
});

const CARRY_OVER_TYPES = ["annual", "sick", "casual"] as const;

export async function POST(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await verifyAccessToken(token);
    assertRole(user, ["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { fromYear } = body.data;
  const toYear = fromYear + 1;

  const org = await prisma.organization.findUnique({ where: { key: "primary" } });
  if (!org?.carryOverEnabled) {
    return NextResponse.json({ error: "Carry-over is disabled for this organization" }, { status: 400 });
  }
  const maxDays = org.carryOverMaxDays ?? null;

  const balances = await prisma.leaveBalance.findMany({
    where: { year: fromYear, leaveType: { in: CARRY_OVER_TYPES } },
  });

  let processed = 0;
  for (const bal of balances) {
    const remaining = Math.max(0, bal.entitlementDays + bal.carriedOverDays - bal.usedDays);
    if (remaining <= 0) continue;
    const carryAmount = maxDays !== null ? Math.min(remaining, maxDays) : remaining;

    await prisma.leaveBalance.upsert({
      where: { userId_year_leaveType: { userId: bal.userId, year: toYear, leaveType: bal.leaveType } },
      create: {
        userId: bal.userId,
        year: toYear,
        leaveType: bal.leaveType,
        entitlementDays: 0,
        carriedOverDays: carryAmount,
        usedDays: 0,
      },
      update: {
        carriedOverDays: { increment: carryAmount },
      },
    });
    processed++;
  }

  return NextResponse.json({ processed, fromYear, toYear });
}
