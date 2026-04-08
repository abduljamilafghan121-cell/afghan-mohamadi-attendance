import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getBearerToken, verifyAccessToken } from "../../../lib/auth";

const LEAVE_TYPES = ["annual", "sick", "casual", "unpaid"] as const;

export async function GET(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let authUser;
  try {
    authUser = await verifyAccessToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);

  const rows = await prisma.leaveBalance.findMany({
    where: { userId: authUser.id, year },
  });

  const balances = LEAVE_TYPES.map((type) => {
    const row = rows.find((r) => r.leaveType === type);
    const entitlementDays = row?.entitlementDays ?? 0;
    const carriedOverDays = row?.carriedOverDays ?? 0;
    const usedDays = row?.usedDays ?? 0;
    return {
      leaveType: type,
      entitlementDays,
      carriedOverDays,
      usedDays,
      remainingDays: Math.max(0, entitlementDays + carriedOverDays - usedDays),
      isSet: !!row,
    };
  });

  return NextResponse.json({ balances, year });
}
