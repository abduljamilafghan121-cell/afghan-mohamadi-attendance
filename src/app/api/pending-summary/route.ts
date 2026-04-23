import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireUser } from "../../../lib/apiAuth";

type PendingItem = {
  id: string;
  title: string;
  subtitle: string;
  createdAt: string;
  link: string;
  user?: { id: string; name: string };
};

type PendingGroup = {
  key: "orders" | "leaves" | "corrections" | "outstation";
  label: string;
  count: number;
  items: PendingItem[];
  reviewLink: string;
};

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const isAdmin = auth.user.role === "admin";
  const userFilter = isAdmin ? {} : { userId: auth.user.id };

  const ordersReviewLink = isAdmin ? "/admin/sales/orders" : "/sales";
  const leavesReviewLink = isAdmin ? "/admin/leaves" : "/profile";
  const correctionsReviewLink = isAdmin ? "/admin/corrections" : "/profile";
  const outstationReviewLink = isAdmin ? "/admin/outstation" : "/sales/outstation";

  const [orders, leaves, corrections, outstation] = await Promise.all([
    prisma.order.findMany({
      where: { status: "pending", ...userFilter },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        user: { select: { id: true, name: true } },
        shop: { select: { name: true } },
      },
    }),
    prisma.leaveRequest.findMany({
      where: { status: "pending", ...userFilter },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.correctionRequest.findMany({
      where: { status: "pending", ...userFilter },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.outstationRequest.findMany({
      where: { status: "pending", ...userFilter },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  const groups: PendingGroup[] = [
    {
      key: "orders",
      label: "Sales orders",
      count: orders.length,
      reviewLink: ordersReviewLink,
      items: orders.map((o) => ({
        id: o.id,
        title: `${o.shop.name} — total ${o.total.toFixed(2)}`,
        subtitle: `${o.paymentType} · ${isAdmin ? `by ${o.user.name}` : "your order"}`,
        createdAt: o.createdAt.toISOString(),
        link: ordersReviewLink,
        user: { id: o.user.id, name: o.user.name },
      })),
    },
    {
      key: "leaves",
      label: "Leave requests",
      count: leaves.length,
      reviewLink: leavesReviewLink,
      items: leaves.map((l) => ({
        id: l.id,
        title: `${l.leaveType} leave`,
        subtitle: `${l.startDate.toISOString().slice(0, 10)} → ${l.endDate.toISOString().slice(0, 10)} · ${
          isAdmin ? `by ${l.user.name}` : "your request"
        }`,
        createdAt: l.createdAt.toISOString(),
        link: leavesReviewLink,
        user: { id: l.user.id, name: l.user.name },
      })),
    },
    {
      key: "corrections",
      label: "Attendance corrections",
      count: corrections.length,
      reviewLink: correctionsReviewLink,
      items: corrections.map((c) => ({
        id: c.id,
        title: `${c.requestType.replace(/_/g, " ")} on ${c.workDate.toISOString().slice(0, 10)}`,
        subtitle: isAdmin ? `by ${c.user.name}` : "your request",
        createdAt: c.createdAt.toISOString(),
        link: correctionsReviewLink,
        user: { id: c.user.id, name: c.user.name },
      })),
    },
    {
      key: "outstation",
      label: "Outstation requests",
      count: outstation.length,
      reviewLink: outstationReviewLink,
      items: outstation.map((o) => ({
        id: o.id,
        title: "Outstation",
        subtitle: `${o.startDate.toISOString().slice(0, 10)} → ${o.endDate.toISOString().slice(0, 10)} · ${
          isAdmin ? `by ${o.user.name}` : "your request"
        }`,
        createdAt: o.createdAt.toISOString(),
        link: outstationReviewLink,
        user: { id: o.user.id, name: o.user.name },
      })),
    },
  ];

  const total = groups.reduce((s, g) => s + g.count, 0);
  return NextResponse.json({ total, groups, scope: isAdmin ? "all" : "mine" });
}
