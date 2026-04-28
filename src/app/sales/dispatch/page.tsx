"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "../../../components/AppShell";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { apiFetch } from "../../../lib/clientApi";
import { getToken } from "../../../lib/clientAuth";
import { openWhatsApp } from "../../../lib/clientWhatsapp";

type OrderItem = {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};
type MessageStatus = "not_attempted" | "link_opened" | "invalid_phone";
type Order = {
  id: string;
  createdAt: string;
  reviewedAt: string | null;
  total: number;
  paymentType: string;
  notes: string | null;
  shop: { id: string; name: string; phone: string | null };
  items: OrderItem[];
};

export default function PendingDispatchPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [dispatchMsg, setDispatchMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch<{ orders: Order[] }>(
        "/api/sales/orders/pending-dispatch",
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
  }, [token]);

  const dispatchOrder = async (orderId: string) => {
    setDispatchingId(orderId);
    setDispatchMsg(null);
    setError(null);
    try {
      const r = await apiFetch<{
        success: boolean;
        messageStatus: MessageStatus;
        messageReason: string | null;
        whatsappUrl: string | null;
      }>(`/api/sales/orders/${orderId}/dispatch`, { method: "POST" });
      if (r.whatsappUrl) {
        openWhatsApp(r.whatsappUrl);
        setDispatchMsg(
          "Order dispatched. WhatsApp opened — press Send to notify the customer.",
        );
      } else {
        setDispatchMsg(
          `Order marked as dispatched, but WhatsApp message could not be prepared: ${r.messageReason ?? "invalid phone number"}`,
        );
      }
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to dispatch");
    } finally {
      setDispatchingId(null);
    }
  };

  const fmt = (d: string) => new Date(d).toLocaleString();

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">
              Pending Dispatch
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Orders approved by the admin and waiting to be sent to the
              customer.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={load}
              disabled={loading}
              className="h-9 px-3 text-xs"
            >
              {loading ? "Loading…" : "Refresh"}
            </Button>
            <Link
              href="/sales"
              className="text-sm text-zinc-600 hover:underline"
            >
              ← Back
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {dispatchMsg && (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            {dispatchMsg}
          </div>
        )}

        {orders.length === 0 ? (
          <Card>
            <p className="py-8 text-center text-sm text-zinc-500">
              {loading ? "Loading…" : "Nothing to dispatch right now."}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <Card key={o.id}>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-zinc-900">
                        {o.shop.name}
                      </div>
                      <div className="text-xs text-zinc-500">
                        Approved {o.reviewedAt ? fmt(o.reviewedAt) : "—"} ·{" "}
                        {o.paymentType.toUpperCase()}
                        {o.shop.phone ? ` · ${o.shop.phone}` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-zinc-900">
                        {o.total.toFixed(2)}
                      </div>
                      <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                        approved
                      </span>
                    </div>
                  </div>

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
                          <span className="font-medium">Qty</span>{" "}
                          {it.quantity}
                          <span className="mx-2 text-zinc-300">·</span>
                          <span className="font-medium">Unit</span>{" "}
                          {it.unitPrice.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Tablet & desktop — table. */}
                  <div className="hidden sm:block overflow-x-auto rounded-lg border border-zinc-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                        <tr>
                          <th className="px-2 py-2 font-medium">Product</th>
                          <th className="px-2 py-2 font-medium">Qty</th>
                          <th className="px-2 py-2 text-right font-medium">
                            Unit
                          </th>
                          <th className="px-2 py-2 text-right font-medium">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {o.items.map((it) => (
                          <tr key={it.id}>
                            <td className="px-2 py-1.5">{it.productName}</td>
                            <td className="px-2 py-1.5">{it.quantity}</td>
                            <td className="px-2 py-1.5 text-right">
                              {it.unitPrice.toFixed(2)}
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              {it.lineTotal.toFixed(2)}
                            </td>
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

                  <div className="flex justify-end">
                    <Button
                      onClick={() => dispatchOrder(o.id)}
                      disabled={dispatchingId === o.id}
                      className="w-full sm:w-auto"
                    >
                      {dispatchingId === o.id
                        ? "Dispatching…"
                        : "Dispatch & notify customer"}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
