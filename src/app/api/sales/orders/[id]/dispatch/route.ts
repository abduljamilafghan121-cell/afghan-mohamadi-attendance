import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { requireUser } from "../../../../../../lib/apiAuth";
import { notifyAdmins, notifyUser } from "../../../../../../lib/notify";
import { logActivity } from "../../../../../../lib/activityLog";
import { validatePhone } from "../../../../../../lib/phone";
import { buildDispatchMessage, buildWhatsappUrl } from "../../../../../../lib/whatsapp";

/**
 * Mark an approved order as dispatched and (if the customer phone is valid)
 * return a wa.me URL the dispatcher can open to send a pre-filled WhatsApp
 * message to the customer.
 *
 * Allowed for: the salesman who placed the order, OR any admin.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      shop: { select: { id: true, name: true, phone: true } },
      user: { select: { id: true, name: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Permission: admin OR the salesman who created this order.
  const isAdmin = auth.user.role === "admin";
  const isOwner = order.userId === auth.user.id;
  if (!isAdmin && !isOwner) {
    return NextResponse.json(
      { error: "You can only dispatch your own orders" },
      { status: 403 },
    );
  }

  if (order.status === "dispatched") {
    return NextResponse.json(
      { error: "Order is already dispatched" },
      { status: 400 },
    );
  }
  if (order.status !== "approved") {
    return NextResponse.json(
      { error: "Only approved orders can be dispatched" },
      { status: 400 },
    );
  }

  // Validate phone — message status depends on this.
  const phoneCheck = validatePhone(order.shop.phone);
  const messageStatus = phoneCheck.valid ? "link_opened" : "invalid_phone";
  const messageReason = phoneCheck.valid ? null : phoneCheck.reason;

  const dispatcher = await prisma.user
    .findUnique({ where: { id: auth.user.id }, select: { name: true } })
    .catch(() => null);
  const dispatcherName = dispatcher?.name ?? "Someone";

  const updated = await prisma.order.update({
    where: { id: params.id },
    data: {
      status: "dispatched",
      dispatchedAt: new Date(),
      dispatchedById: auth.user.id,
      messageStatus,
      messageReason,
    },
    include: {
      shop: { select: { id: true, name: true, phone: true } },
      user: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
      dispatchedBy: { select: { id: true, name: true } },
      items: true,
    },
  });

  // Build WhatsApp URL if phone is valid.
  let whatsappUrl: string | null = null;
  if (phoneCheck.valid) {
    const message = buildDispatchMessage({
      customerName: updated.shop.name,
      orderId: updated.id,
      total: updated.total,
      paymentType: updated.paymentType,
      salesmanName: updated.user?.name ?? dispatcherName,
      dispatchedAt: updated.dispatchedAt ?? new Date(),
    });
    whatsappUrl = buildWhatsappUrl(phoneCheck.phone, message);
  }

  // Notifications: tell the OTHER side. If the salesman dispatched,
  // notify the admin who reviewed (and broadcast to admins). If an admin
  // dispatched, notify the salesman.
  if (isAdmin && order.userId !== auth.user.id) {
    await notifyUser({
      userId: order.userId,
      type: "order_decided",
      title: "Order dispatched",
      body: `${dispatcherName} dispatched your order for ${updated.shop.name} (total ${updated.total.toFixed(2)}).`,
      link: "/sales/report",
    }).catch(() => null);
  } else if (isOwner) {
    // Salesman dispatched — notify admins so they have a record.
    await notifyAdmins({
      type: "order_decided",
      title: "Order dispatched by salesman",
      body: `${dispatcherName} dispatched the order for ${updated.shop.name} (total ${updated.total.toFixed(2)}).`,
      link: "/admin/sales/orders?status=dispatched",
    }).catch(() => null);
  }

  logActivity(
    auth.user.id,
    "order_dispatched",
    isAdmin ? "admin" : "sales",
    `Order for ${updated.shop.name} · total ${updated.total.toFixed(2)} · message ${messageStatus}${messageReason ? ` (${messageReason})` : ""}`,
  ).catch(() => null);

  return NextResponse.json({
    success: true,
    messageStatus,
    messageReason,
    whatsappUrl,
    order: updated,
  });
}
