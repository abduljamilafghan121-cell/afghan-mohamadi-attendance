"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "../../../../components/AppShell";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { Combobox } from "../../../../components/ui/Combobox";
import { apiFetch } from "../../../../lib/clientApi";
import { getToken, parseJwt } from "../../../../lib/clientAuth";
import { openWhatsApp } from "../../../../lib/clientWhatsapp";
import { exportHtmlReport } from "../../../../lib/exportUtils";

type Product = { id: string; name: string; price: number };
// `unitPrice` is an explicit price override. When null, the line uses the
// product's catalogue price.
type EditLine = { productId: string; quantity: number; unitPrice: number | null };

type Item = {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};
type OrderStatus = "pending" | "approved" | "rejected" | "dispatched";
type MessageStatus = "not_attempted" | "link_opened" | "invalid_phone";
type Order = {
  id: string;
  total: number;
  paymentType: string;
  status: OrderStatus;
  notes: string | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
  dispatchedAt: string | null;
  messageStatus: MessageStatus;
  messageReason: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string | null };
  shop: { id: string; name: string; phone: string | null };
  items: Item[];
  reviewedBy: { id: string; name: string } | null;
  dispatchedBy: { id: string; name: string } | null;
};

const tabs: { key: OrderStatus; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "dispatched", label: "Dispatched" },
  { key: "rejected", label: "Rejected" },
];

export default function AdminOrdersPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [status, setStatus] = useState<OrderStatus>("pending");
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [dispatchMsg, setDispatchMsg] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");

  const dispatchOrder = async (id: string) => {
    setBusyId(id);
    setDispatchMsg(null);
    setError(null);
    try {
      const r = await apiFetch<{
        success: boolean;
        messageStatus: MessageStatus;
        messageReason: string | null;
        whatsappUrl: string | null;
      }>(`/api/sales/orders/${id}/dispatch`, { method: "POST" });
      if (r.whatsappUrl) {
        openWhatsApp(r.whatsappUrl);
        setDispatchMsg("Order dispatched. WhatsApp opened — press Send to notify the customer.");
      } else {
        setDispatchMsg(
          `Order marked as dispatched, but WhatsApp message could not be prepared: ${r.messageReason ?? "invalid phone"}`,
        );
      }
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to dispatch");
    } finally {
      setBusyId(null);
    }
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLines, setEditLines] = useState<EditLine[]>([]);
  const [editPaymentType, setEditPaymentType] = useState<"cash" | "credit">("cash");
  const [editNotes, setEditNotes] = useState("");

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  useEffect(() => {
    if (!token) router.push("/login");
    if (user && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  useEffect(() => {
    fetch("/api/org").then((r) => r.json()).then((d) => { if (d?.org?.title) setOrgName(d.org.title); }).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch<{ orders: Order[] }>(
        `/api/admin/sales/orders?status=${status}`,
      );
      setOrders(r.orders);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status]);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ products: Product[] }>("/api/sales/products")
      .then((r) => setProducts(r.products))
      .catch(() => {});
  }, [token]);

  const startEdit = (o: Order) => {
    setEditingId(o.id);
    setEditLines(
      o.items.map((it) => ({
        productId: it.productId ?? "",
        quantity: it.quantity,
        // Preload existing price as an explicit override so we never silently
        // change a line's price just because the catalogue has moved.
        unitPrice: it.unitPrice,
      })),
    );
    setEditPaymentType((o.paymentType as "cash" | "credit") ?? "cash");
    setEditNotes(o.notes ?? "");
    setNoteFor(null);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLines([]);
    setEditNotes("");
  };

  const updateEditLine = (i: number, patch: Partial<EditLine>) =>
    setEditLines((arr) => arr.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  // Picking a different product clears any previous price override and reverts
  // to the new product's catalogue price.
  const updateEditLineProduct = (i: number, productId: string) =>
    setEditLines((arr) =>
      arr.map((l, idx) => (idx === i ? { ...l, productId, unitPrice: null } : l)),
    );
  const addEditLine = () =>
    setEditLines((arr) => [...arr, { productId: "", quantity: 1, unitPrice: null }]);
  const removeEditLine = (i: number) =>
    setEditLines((arr) => arr.filter((_, idx) => idx !== i));

  const editEffectivePrice = (l: EditLine): number => {
    if (l.unitPrice != null) return l.unitPrice;
    const p = productMap.get(l.productId);
    return p ? p.price : 0;
  };

  const editTotal = useMemo(() => {
    return editLines.reduce(
      (sum, l) => sum + editEffectivePrice(l) * (l.quantity || 0),
      0,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editLines, productMap]);

  const saveEdit = async (id: string) => {
    const valid = editLines.filter((l) => l.productId && l.quantity > 0);
    if (valid.length === 0) {
      setError("Add at least one item with a quantity.");
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/api/admin/sales/orders/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          paymentType: editPaymentType,
          notes: editNotes || null,
          items: valid.map((l) => ({
            productId: l.productId,
            quantity: Number(l.quantity),
            // Send the price only when explicitly overridden.
            ...(l.unitPrice != null ? { unitPrice: Number(l.unitPrice) } : {}),
          })),
        }),
      });
      cancelEdit();
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to save");
    } finally {
      setBusyId(null);
    }
  };

  const decide = async (id: string, decision: "approved" | "rejected") => {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/api/admin/sales/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: decision,
          reviewNotes: noteFor === id ? noteText || null : null,
        }),
      });
      setNoteFor(null);
      setNoteText("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const fmt = (d: string) => new Date(d).toLocaleString();

  const exportOrderPdf = async (o: Order) => {
    try {
      const esc = (v: string) =>
        v.replace(/[&<>"']/g, (c) =>
          c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
        );

      const statusLabel = o.status.charAt(0).toUpperCase() + o.status.slice(1);
      const statusColor =
        o.status === "pending" ? "#b45309" :
        o.status === "approved" ? "#15803d" :
        o.status === "dispatched" ? "#1d4ed8" : "#b91c1c";

      const orderRef = o.id.slice(-8).toUpperCase();

      const itemRows = o.items.map((it, i) => `
        <tr>
          <td class="center">${i + 1}</td>
          <td>${esc(it.productName)}</td>
          <td class="center">${it.quantity}</td>
          <td class="right">${it.unitPrice.toFixed(2)}</td>
          <td class="right"><strong>${it.lineTotal.toFixed(2)}</strong></td>
        </tr>`).join("");

      const reviewBlock = o.reviewedBy ? `
        <tr>
          <td class="label">${o.status === "dispatched" ? "Approved By" : statusLabel + " By"}</td>
          <td>${esc(o.reviewedBy.name)}${o.reviewedAt ? ` &nbsp;·&nbsp; ${fmt(o.reviewedAt)}` : ""}${o.reviewNotes ? `<br/><em style="color:#666">"${esc(o.reviewNotes)}"</em>` : ""}</td>
        </tr>` : "";

      const dispatchBlock = o.status === "dispatched" && o.dispatchedBy ? `
        <tr>
          <td class="label">Dispatched By</td>
          <td>${esc(o.dispatchedBy.name)}${o.dispatchedAt ? ` &nbsp;·&nbsp; ${fmt(o.dispatchedAt)}` : ""}</td>
        </tr>` : "";

      const notesBlock = o.notes ? `
        <tr>
          <td class="label">Order Notes</td>
          <td>${esc(o.notes)}</td>
        </tr>` : "";

      const reviewNotesBlock = o.reviewNotes && !o.reviewedBy ? `
        <tr>
          <td class="label">Review Notes</td>
          <td>${esc(o.reviewNotes)}</td>
        </tr>` : "";

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Order ${orderRef} — ${esc(orgName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 40px; font-size: 12px; }

    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #111; padding-bottom: 20px; margin-bottom: 28px; }
    .header-left h1 { font-size: 24px; font-weight: bold; letter-spacing: 1px; }
    .header-left h2 { font-size: 13px; color: #555; margin-top: 4px; font-weight: normal; }
    .header-right { text-align: right; }
    .order-ref { font-size: 20px; font-weight: bold; color: #111; }
    .order-date { font-size: 11px; color: #777; margin-top: 4px; }
    .status-badge { display: inline-block; margin-top: 8px; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: bold; color: ${statusColor}; border: 1.5px solid ${statusColor}; }

    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }
    .info-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; }
    .info-box .box-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.6px; color: #888; margin-bottom: 8px; font-weight: bold; }
    .info-box .box-row { display: flex; gap: 6px; margin-bottom: 4px; }
    .info-box .box-label { font-size: 10px; color: #777; min-width: 80px; }
    .info-box .box-value { font-size: 11px; color: #111; font-weight: 500; }

    .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: #888; font-weight: bold; margin-bottom: 10px; }
    table.items { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
    table.items th { background: #f3f4f6; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; text-align: left; border-bottom: 2px solid #ddd; }
    table.items th.center, table.items td.center { text-align: center; }
    table.items th.right, table.items td.right { text-align: right; }
    table.items td { padding: 9px 10px; border-bottom: 1px solid #eee; }
    table.items tr:last-child td { border-bottom: none; }
    table.items tr:nth-child(even) td { background: #fafafa; }
    .total-row { display: flex; justify-content: flex-end; margin-bottom: 28px; }
    .total-box { border: 2px solid #111; border-radius: 8px; padding: 12px 20px; text-align: right; min-width: 200px; }
    .total-box .total-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #777; }
    .total-box .total-value { font-size: 26px; font-weight: bold; color: #111; margin-top: 2px; }
    .total-box .payment-type { font-size: 10px; color: #555; margin-top: 4px; }

    table.meta { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
    table.meta td { padding: 7px 10px; border-bottom: 1px solid #eee; font-size: 11px; vertical-align: top; }
    table.meta td.label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; font-weight: bold; width: 140px; padding-top: 9px; }
    table.meta tr:last-child td { border-bottom: none; }

    .footer { margin-top: 32px; font-size: 10px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 14px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>

  <div class="header">
    <div class="header-left">
      <h1>${esc(orgName || "Attendix")}</h1>
      <h2>Sales Order</h2>
    </div>
    <div class="header-right">
      <div class="order-ref">Order #${orderRef}</div>
      <div class="order-date">Placed on ${fmt(o.createdAt)}</div>
      <div><span class="status-badge">${statusLabel}</span></div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <div class="box-title">Shop / Customer</div>
      <div class="box-row"><span class="box-label">Shop Name</span><span class="box-value">${esc(o.shop.name)}</span></div>
      ${o.shop.phone ? `<div class="box-row"><span class="box-label">Phone</span><span class="box-value">${esc(o.shop.phone)}</span></div>` : ""}
    </div>
    <div class="info-box">
      <div class="box-title">Order Info</div>
      <div class="box-row"><span class="box-label">Sales Rep</span><span class="box-value">${esc(o.user.name)}</span></div>
      <div class="box-row"><span class="box-label">Payment</span><span class="box-value">${o.paymentType.charAt(0).toUpperCase() + o.paymentType.slice(1)}</span></div>
      <div class="box-row"><span class="box-label">Order Ref</span><span class="box-value">#${orderRef}</span></div>
    </div>
  </div>

  <div class="section-title">Order Items</div>
  <table class="items">
    <thead>
      <tr>
        <th class="center">#</th>
        <th>Product</th>
        <th class="center">Qty</th>
        <th class="right">Unit Price</th>
        <th class="right">Line Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="total-row">
    <div class="total-box">
      <div class="total-label">Order Total</div>
      <div class="total-value">${o.total.toFixed(2)}</div>
      <div class="payment-type">${o.paymentType.charAt(0).toUpperCase() + o.paymentType.slice(1)} Payment</div>
    </div>
  </div>

  ${(reviewBlock || dispatchBlock || notesBlock || reviewNotesBlock) ? `
  <div class="section-title">Order History</div>
  <table class="meta">
    <tbody>
      ${reviewBlock}
      ${dispatchBlock}
      ${notesBlock}
      ${reviewNotesBlock}
    </tbody>
  </table>` : ""}

  <div class="footer">
    Generated on ${new Date().toLocaleString()} &nbsp;|&nbsp; ${esc(orgName || "Attendix")} — Sales Orders System
  </div>
</body>
</html>`;

      await exportHtmlReport(`order_${orderRef}_${o.shop.name.replace(/\s+/g, "_")}`, html);
    } catch (e: any) {
      alert(e?.message ?? "Export failed");
    }
  };

  const exportPdf = async () => {
    try {
      const esc = (v: string) =>
        v.replace(/[&<>"']/g, (c) =>
          c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
        );

      const totalValue = orders.reduce((s, o) => s + o.total, 0);
      const cashCount = orders.filter((o) => o.paymentType === "cash").length;
      const creditCount = orders.filter((o) => o.paymentType === "credit").length;
      const cashValue = orders.filter((o) => o.paymentType === "cash").reduce((s, o) => s + o.total, 0);
      const creditValue = orders.filter((o) => o.paymentType === "credit").reduce((s, o) => s + o.total, 0);

      const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
      const statusColor =
        status === "pending" ? "#b45309" :
        status === "approved" ? "#15803d" :
        status === "dispatched" ? "#1d4ed8" : "#b91c1c";

      const tableRows = orders.map((o, idx) => {
        const itemsList = o.items.map((it) =>
          `${esc(it.productName)} × ${it.quantity} @ ${it.unitPrice.toFixed(2)}`
        ).join("<br/>");

        const reviewLine = o.reviewedBy
          ? `${statusLabel} by ${esc(o.reviewedBy.name)}${o.reviewedAt ? ` on ${fmt(o.reviewedAt)}` : ""}${o.reviewNotes ? `<br/><em>"${esc(o.reviewNotes)}"</em>` : ""}`
          : "—";

        const dispatchLine = o.status === "dispatched" && o.dispatchedBy
          ? `${esc(o.dispatchedBy.name)}${o.dispatchedAt ? `<br/>${fmt(o.dispatchedAt)}` : ""}`
          : status === "dispatched" ? "—" : "";

        return `
        <tr>
          <td class="center">${idx + 1}</td>
          <td>${fmt(o.createdAt)}</td>
          <td><strong>${esc(o.shop.name)}</strong></td>
          <td>${esc(o.user.name)}</td>
          <td class="center">${o.paymentType.charAt(0).toUpperCase() + o.paymentType.slice(1)}</td>
          <td class="items">${itemsList}</td>
          <td class="right"><strong>${o.total.toFixed(2)}</strong></td>
          <td>${reviewLine}</td>
          ${status === "dispatched" ? `<td>${dispatchLine}</td>` : ""}
          <td>${o.notes ? esc(o.notes) : "—"}</td>
        </tr>`;
      }).join("");

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Orders Report — ${statusLabel} — ${orgName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 32px; font-size: 11px; }
    .header { text-align: center; border-bottom: 3px solid #111; padding-bottom: 16px; margin-bottom: 20px; }
    .header h1 { font-size: 22px; font-weight: bold; letter-spacing: 1px; }
    .header h2 { font-size: 15px; color: #444; margin-top: 4px; }
    .header .status-badge { display: inline-block; margin-top: 8px; padding: 3px 14px; border-radius: 20px; font-size: 12px; font-weight: bold; color: ${statusColor}; border: 1.5px solid ${statusColor}; }
    .header .meta { font-size: 10px; color: #888; margin-top: 6px; }
    .summary { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
    .summary-box { border: 1px solid #ddd; border-radius: 6px; padding: 10px 16px; min-width: 110px; text-align: center; }
    .summary-box .label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-box .value { font-size: 18px; font-weight: bold; margin-top: 2px; color: #111; }
    .summary-box .sub { font-size: 9px; color: #666; margin-top: 2px; }
    .summary-box.total .value { color: #1d4ed8; }
    .summary-box.cash .value { color: #15803d; }
    .summary-box.credit .value { color: #b45309; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    th { background: #f3f4f6; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 8px; text-align: left; border-bottom: 2px solid #ddd; white-space: nowrap; }
    th.center, td.center { text-align: center; }
    th.right, td.right { text-align: right; }
    td { padding: 7px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
    tr:nth-child(even) td { background: #fafafa; }
    td.items { font-size: 10px; color: #333; line-height: 1.6; }
    .footer { margin-top: 24px; font-size: 10px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${esc(orgName || "Attendix")}</h1>
    <h2>Sales Orders Report</h2>
    <div><span class="status-badge">${statusLabel} Orders</span></div>
    <div class="meta">Generated on ${new Date().toLocaleString()} &nbsp;|&nbsp; Exported by ${esc(user?.name ?? "Admin")}</div>
  </div>

  <div class="summary">
    <div class="summary-box total">
      <div class="label">Total Orders</div>
      <div class="value">${orders.length}</div>
    </div>
    <div class="summary-box total">
      <div class="label">Total Value</div>
      <div class="value">${totalValue.toFixed(2)}</div>
    </div>
    <div class="summary-box cash">
      <div class="label">Cash Orders</div>
      <div class="value">${cashCount}</div>
      <div class="sub">${cashValue.toFixed(2)}</div>
    </div>
    <div class="summary-box credit">
      <div class="label">Credit Orders</div>
      <div class="value">${creditCount}</div>
      <div class="sub">${creditValue.toFixed(2)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center">#</th>
        <th>Date</th>
        <th>Shop</th>
        <th>Sales Rep</th>
        <th class="center">Payment</th>
        <th>Items</th>
        <th class="right">Total</th>
        <th>Review Info</th>
        ${status === "dispatched" ? "<th>Dispatched By</th>" : ""}
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <div class="footer">
    Generated on ${new Date().toLocaleString()} &nbsp;|&nbsp; ${esc(orgName || "Attendix")} — Sales Orders System
  </div>
</body>
</html>`;

      await exportHtmlReport(`orders_${status}_${new Date().toISOString().slice(0, 10)}`, html);
    } catch (e: any) {
      alert(e?.message ?? "Export failed");
    }
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-zinc-900">Order Approvals</h1>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={exportPdf}
              disabled={loading || orders.length === 0}
              className="h-9 px-3 text-xs"
            >
              Export PDF
            </Button>
            <Button variant="secondary" onClick={load} disabled={loading} className="h-9 px-3 text-xs">
              {loading ? "Loading…" : "Refresh"}
            </Button>
          </div>
        </div>

        <div className="flex gap-1 border-b border-zinc-200">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
                status === t.key
                  ? "border-emerald-600 text-emerald-700 font-medium"
                  : "border-transparent text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        {dispatchMsg && (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            {dispatchMsg}
          </div>
        )}

        {orders.length === 0 ? (
          <Card>
            <p className="text-sm text-zinc-500 text-center py-8">
              No {status} orders.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <Card key={o.id}>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-zinc-900">{o.shop.name}</div>
                      <div className="text-xs text-zinc-500">
                        by {o.user.name} • {fmt(o.createdAt)} • {o.paymentType}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">{o.total.toFixed(2)}</div>
                      <div className="mt-1 flex flex-wrap items-center justify-end gap-1">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                            o.status === "pending"
                              ? "bg-amber-100 text-amber-800"
                              : o.status === "approved"
                                ? "bg-emerald-100 text-emerald-800"
                                : o.status === "dispatched"
                                  ? "bg-indigo-100 text-indigo-800"
                                  : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {o.status}
                        </span>
                        {o.status === "dispatched" && o.messageStatus !== "not_attempted" && (
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] ${
                              o.messageStatus === "link_opened"
                                ? "bg-indigo-50 text-indigo-700"
                                : "bg-red-50 text-red-700"
                            }`}
                            title={o.messageReason ?? ""}
                          >
                            {o.messageStatus === "link_opened"
                              ? "✓ message link opened"
                              : "⚠ phone invalid"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {editingId === o.id ? (
                    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
                      {/* Mobile (portrait) — stacked card per editable line. */}
                      <div className="space-y-3 sm:hidden">
                        {editLines.map((l, i) => {
                          const p = productMap.get(l.productId);
                          const price = editEffectivePrice(l);
                          const lineTotal = price * (l.quantity || 0);
                          const overridden =
                            l.unitPrice != null && p != null && l.unitPrice !== p.price;
                          return (
                            <div
                              key={i}
                              className="rounded-xl border border-zinc-200 bg-white p-3 space-y-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                  Item {i + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeEditLine(i)}
                                  className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                                >
                                  ✕ Remove
                                </button>
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-zinc-600">Product</label>
                                <Combobox
                                  options={products.map((pp) => ({
                                    id: pp.id,
                                    label: pp.name,
                                    hint: pp.price.toFixed(2),
                                  }))}
                                  value={l.productId}
                                  onChange={(id) => updateEditLineProduct(i, id)}
                                  placeholder="Search products…"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="mb-1 block text-xs font-medium text-zinc-600">Qty</label>
                                  <Input
                                    type="number"
                                    min={1}
                                    className="h-9 w-full"
                                    value={l.quantity}
                                    onChange={(e) =>
                                      updateEditLine(i, {
                                        quantity: parseInt(e.target.value, 10) || 0,
                                      })
                                    }
                                  />
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs font-medium text-zinc-600">Price</label>
                                  <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    className="h-9 w-full text-right"
                                    value={p ? price : ""}
                                    disabled={!p}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      updateEditLine(i, {
                                        unitPrice: v === "" ? 0 : Number(v),
                                      });
                                    }}
                                  />
                                  {overridden && p && (
                                    <div className="mt-0.5 text-[10px] text-amber-700">
                                      List: {p.price.toFixed(2)}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2">
                                <span className="text-xs text-zinc-600">Line total</span>
                                <span className="text-sm font-semibold text-zinc-900">
                                  {lineTotal.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Tablet & desktop — original table. */}
                      <div className="hidden sm:block overflow-x-auto rounded-lg border border-zinc-200 bg-white">
                        <table className="min-w-full text-sm">
                          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                            <tr>
                              <th className="px-2 py-2 font-medium">Product</th>
                              <th className="px-2 py-2 font-medium">Qty</th>
                              <th className="px-2 py-2 text-right font-medium">Price</th>
                              <th className="px-2 py-2 text-right font-medium">Total</th>
                              <th className="px-2 py-2"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {editLines.map((l, i) => {
                              const p = productMap.get(l.productId);
                              const price = editEffectivePrice(l);
                              const lineTotal = price * (l.quantity || 0);
                              const overridden =
                                l.unitPrice != null && p != null && l.unitPrice !== p.price;
                              return (
                                <tr key={i}>
                                  <td className="px-2 py-2 min-w-[180px]">
                                    <Combobox
                                      options={products.map((pp) => ({
                                        id: pp.id,
                                        label: pp.name,
                                        hint: pp.price.toFixed(2),
                                      }))}
                                      value={l.productId}
                                      onChange={(id) => updateEditLineProduct(i, id)}
                                      placeholder="Search products…"
                                    />
                                  </td>
                                  <td className="px-2 py-2">
                                    <Input
                                      type="number"
                                      min={1}
                                      className="h-9 w-20"
                                      value={l.quantity}
                                      onChange={(e) =>
                                        updateEditLine(i, {
                                          quantity: parseInt(e.target.value, 10) || 0,
                                        })
                                      }
                                    />
                                  </td>
                                  <td className="px-2 py-2 text-right">
                                    <Input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      className="h-9 w-24 text-right"
                                      value={p ? price : ""}
                                      disabled={!p}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        updateEditLine(i, {
                                          unitPrice: v === "" ? 0 : Number(v),
                                        });
                                      }}
                                    />
                                    {overridden && p && (
                                      <div className="mt-0.5 text-[10px] text-amber-700">
                                        List: {p.price.toFixed(2)}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-2 py-2 text-right font-medium">
                                    {lineTotal.toFixed(2)}
                                  </td>
                                  <td className="px-2 py-2 text-right">
                                    <button
                                      type="button"
                                      onClick={() => removeEditLine(i)}
                                      className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                                    >
                                      ✕
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex items-center justify-between">
                        <Button variant="secondary" type="button" onClick={addEditLine}>
                          + Add item
                        </Button>
                        <span className="text-sm">
                          New total: <span className="font-semibold">{editTotal.toFixed(2)}</span>
                        </span>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">
                          Payment Type
                        </label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={editPaymentType === "cash" ? "primary" : "secondary"}
                            onClick={() => setEditPaymentType("cash")}
                          >
                            Cash
                          </Button>
                          <Button
                            type="button"
                            variant={editPaymentType === "credit" ? "primary" : "secondary"}
                            onClick={() => setEditPaymentType("credit")}
                          >
                            Credit
                          </Button>
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">Notes</label>
                        <Input
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Optional notes"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => saveEdit(o.id)} disabled={busyId === o.id}>
                          {busyId === o.id ? "Saving…" : "Save changes"}
                        </Button>
                        <Button variant="secondary" onClick={cancelEdit} disabled={busyId === o.id}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Mobile (portrait) — line cards. */}
                      <div className="space-y-2 sm:hidden">
                        {o.items.map((it) => (
                          <div
                            key={it.id}
                            className="rounded-lg border border-zinc-200 bg-white p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-medium text-zinc-900">
                                {it.productName}
                              </span>
                              <span className="text-sm font-semibold text-zinc-900">
                                {it.lineTotal.toFixed(2)}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-zinc-600">
                              <span className="font-medium">Qty</span> {it.quantity}
                              <span className="mx-2 text-zinc-300">·</span>
                              <span className="font-medium">Unit</span> {it.unitPrice.toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Tablet & desktop — original table. */}
                      <div className="hidden sm:block overflow-x-auto rounded-lg border border-zinc-200">
                        <table className="min-w-full text-sm">
                          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                            <tr>
                              <th className="px-2 py-2 font-medium">Product</th>
                              <th className="px-2 py-2 font-medium">Qty</th>
                              <th className="px-2 py-2 text-right font-medium">Unit</th>
                              <th className="px-2 py-2 text-right font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {o.items.map((it) => (
                              <tr key={it.id}>
                                <td className="px-2 py-1.5">{it.productName}</td>
                                <td className="px-2 py-1.5">{it.quantity}</td>
                                <td className="px-2 py-1.5 text-right">{it.unitPrice.toFixed(2)}</td>
                                <td className="px-2 py-1.5 text-right">{it.lineTotal.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {o.notes && (
                        <p className="text-xs text-zinc-600">
                          <span className="font-medium">Notes:</span> {o.notes}
                        </p>
                      )}
                    </>
                  )}

                  {o.status !== "pending" && (
                    <div className="space-y-1 text-xs text-zinc-500">
                      {(o.status === "approved" || o.status === "rejected" || o.status === "dispatched") && o.reviewedBy && (
                        <p>
                          {o.status === "dispatched" ? "approved" : o.status} by {o.reviewedBy?.name ?? "—"}
                          {o.reviewedAt ? ` on ${fmt(o.reviewedAt)}` : ""}
                          {o.reviewNotes ? ` • "${o.reviewNotes}"` : ""}
                        </p>
                      )}
                      {o.status === "dispatched" && (
                        <p>
                          dispatched by {o.dispatchedBy?.name ?? "—"}
                          {o.dispatchedAt ? ` on ${fmt(o.dispatchedAt)}` : ""}
                          {o.messageReason ? ` • ${o.messageReason}` : ""}
                        </p>
                      )}
                    </div>
                  )}

                  {o.status === "approved" && (
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => exportOrderPdf(o)}
                        className="h-9 px-3 text-xs rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
                      >
                        ↓ Download PDF
                      </button>
                      <Button
                        onClick={() => dispatchOrder(o.id)}
                        disabled={busyId === o.id}
                        className="h-9 px-3 text-xs"
                      >
                        {busyId === o.id ? "Dispatching…" : "Dispatch & notify customer"}
                      </Button>
                    </div>
                  )}

                  {(o.status === "dispatched" || o.status === "rejected") && (
                    <div className="flex justify-start">
                      <button
                        type="button"
                        onClick={() => exportOrderPdf(o)}
                        className="h-9 px-3 text-xs rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
                      >
                        ↓ Download PDF
                      </button>
                    </div>
                  )}

                  {o.status === "pending" && editingId !== o.id && (
                    <div className="space-y-2">
                      {noteFor === o.id && (
                        <input
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                          placeholder="Optional note (e.g. reason for rejection)…"
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                        />
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => decide(o.id, "approved")}
                          disabled={busyId === o.id}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => decide(o.id, "rejected")}
                          disabled={busyId === o.id}
                        >
                          Reject
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => startEdit(o)}
                          disabled={busyId === o.id}
                        >
                          Edit
                        </Button>
                        <button
                          type="button"
                          onClick={() => exportOrderPdf(o)}
                          className="h-9 px-3 text-xs rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
                        >
                          ↓ Download PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (noteFor === o.id) {
                              setNoteFor(null);
                              setNoteText("");
                            } else {
                              setNoteFor(o.id);
                              setNoteText("");
                            }
                          }}
                          className="text-xs text-zinc-600 underline"
                        >
                          {noteFor === o.id ? "Hide note" : "Add note"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="text-center">
          <Link href="/admin/sales/dashboard" className="text-xs text-zinc-500 hover:underline">
            ← Back to Sales Dashboard
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
