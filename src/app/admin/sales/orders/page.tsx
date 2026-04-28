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

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-zinc-900">Order Approvals</h1>
          <Button variant="secondary" onClick={load} disabled={loading} className="h-9 px-3 text-xs">
            {loading ? "Loading…" : "Refresh"}
          </Button>
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
                    <div className="flex justify-end">
                      <Button
                        onClick={() => dispatchOrder(o.id)}
                        disabled={busyId === o.id}
                        className="h-9 px-3 text-xs"
                      >
                        {busyId === o.id ? "Dispatching…" : "Dispatch & notify customer"}
                      </Button>
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
