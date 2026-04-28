import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { requireUser } from "../../../../../lib/apiAuth";

/**
 * Lists the current salesman's orders that are approved by the admin but
 * not yet dispatched to the customer. This powers the dedicated
 * `/sales/dispatch` page so the salesman doesn't have to dig through the
 * full daily report to find what still needs to be sent out.
 *
 * Note: not date-bounded — an order approved today may stay here for
 * days until the salesman dispatches it.
 */
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const orders = await prisma.order.findMany({
    where: { userId: auth.user.id, status: "approved" },
    orderBy: { reviewedAt: "asc" },
    include: {
      shop: { select: { id: true, name: true, phone: true } },
      items: true,
    },
  });

  return NextResponse.json({ orders });
}
