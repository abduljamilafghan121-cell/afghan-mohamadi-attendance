/**
 * WhatsApp dispatch-message helpers.
 *
 * We use the free `wa.me` deep link, which opens WhatsApp on the
 * dispatcher's device with the message pre-filled. The dispatcher
 * still presses Send manually. This means we never confirm delivery —
 * the most we can say is that the link was opened.
 *
 * The message is bilingual (English + Pashto) so the customer reads
 * whichever is most comfortable for them.
 */

export type DispatchMessageContext = {
  customerName: string;
  orderId: string;
  total: number;
  paymentType: string;       // "cash" | "credit"
  salesmanName: string;
  dispatchedAt?: Date;
};

const fmtAmount = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const shortOrderId = (id: string) =>
  id.length > 8 ? id.slice(-8).toUpperCase() : id.toUpperCase();

/** Builds the bilingual dispatch message (English on top, Pashto below). */
export function buildDispatchMessage(ctx: DispatchMessageContext): string {
  const date = ctx.dispatchedAt ?? new Date();
  const orderRef = shortOrderId(ctx.orderId);
  const amount = fmtAmount(ctx.total);
  const payment = ctx.paymentType.toUpperCase();
  const dateStr = fmtDate(date);

  const en =
    `Hello ${ctx.customerName},\n\n` +
    `Good news! Your order #${orderRef} is on its way.\n\n` +
    `Order total: ${amount} AFN\n` +
    `Payment: ${payment}\n` +
    `Dispatched on: ${dateStr}\n\n` +
    `Please contact me if you haven't received your order in the next 48 hours.\n` +
    `Thank you for your business,\n` +
    `${ctx.salesmanName}`;

  const ps =
    `سلام ${ctx.customerName}،\n\n` +
    `ښه خبر! ستاسو سپارښتنه #${orderRef} په لاره ده.\n\n` +
    `د سپارښتنې ټوله: ${amount} افغانۍ\n` +
    `د پیسو ډول: ${payment}\n` +
    `د لیږلو نېټه: ${dateStr}\n\n` +
    `که چېرې په راتلونکو ۴۸ ساعتونو کې مو سپارښتنه ترلاسه نه کړه، مهرباني وکړئ زما سره اړیکه ونیسئ.\n` +
    `ستاسو د سوداګرۍ څخه مننه،\n` +
    `${ctx.salesmanName}`;

  return `${en}\n\n— — — — —\n\n${ps}`;
}

/** Builds the wa.me URL. `phone` must be digits-only with country code. */
export function buildWhatsappUrl(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
