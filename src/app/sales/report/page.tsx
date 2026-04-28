"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "../../../components/AppShell";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { apiFetch } from "../../../lib/clientApi";
import { getToken } from "../../../lib/clientAuth";
import { openWhatsApp } from "../../../lib/clientWhatsapp";

type Summary = {
  totalVisits: number;
  totalOrdersValue: number;
  cashOrders: number;
  creditOrders: number;
  totalCollections: number;
  ordersCount: number;
  shopsCount: number;
};
type VisitProduct = { id: string; productName: string; offeredPrice: number | null; discussion: string | null; interest: string | null };
type Visit = { id: string; visitDate: string; customerType: string; notes: string | null; shop: { id: string; name: string }; products: VisitProduct[] };
type OrderItem = { id: string; productName: string; quantity: number; unitPrice: number; lineTotal: number };
type OrderStatus = "pending" | "approved" | "rejected" | "dispatched";
type MessageStatus = "not_attempted" | "link_opened" | "invalid_phone";
type Order = {
  id: string;
  createdAt: string;
  total: number;
  paymentType: string;
  status: OrderStatus;
  messageStatus: MessageStatus;
  messageReason: string | null;
  dispatchedAt: string | null;
  shop: { id: string; name: string; phone: string | null };
  items: OrderItem[];
};
type Payment = { id: string; createdAt: string; customerName: string; amount: number; method: string; shop: { id: string; name: string } | null };
type Shop = { id: string; name: string };

function todayStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export default function MyReportPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const [date, setDate] = useState(todayStr());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [dispatchMsg, setDispatchMsg] = useState<string | null>(null);

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
        setDispatchMsg("Order dispatched. WhatsApp opened — press Send to notify the customer.");
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

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch<{
        summary: Summary;
        visits: Visit[];
        orders: Order[];
        payments: Payment[];
        shopsVisited: Shop[];
      }>(`/api/sales/my-report?date=${date}`);
      setSummary(r.summary);
      setVisits(r.visits);
      setOrders(r.orders);
      setPayments(r.payments);
      setShops(r.shopsVisited);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, date]);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-zinc-900">My Daily Report</h1>
          <Link href="/sales" className="text-sm text-zinc-600 hover:underline">
            ← Back
          </Link>
        </div>

        <Card>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <Button variant="secondary" onClick={load} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </Button>
          </div>
        </Card>

        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {dispatchMsg && (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            {dispatchMsg}
          </div>
        )}

        {summary && (
          <Card title="Summary">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Visits" value={summary.totalVisits} />
              <Stat label="Orders" value={summary.ordersCount} />
              <Stat label="Sales Value" value={summary.totalOrdersValue.toFixed(2)} />
              <Stat label="Collections" value={summary.totalCollections.toFixed(2)} />
              <Stat label="Cash Orders" value={summary.cashOrders.toFixed(2)} />
              <Stat label="Credit Orders" value={summary.creditOrders.toFixed(2)} />
              <Stat label="Customers Visited" value={summary.shopsCount} />
            </div>
          </Card>
        )}

        <Card title={`Customers visited (${shops.length})`}>
          {shops.length === 0 ? (
            <p className="text-sm text-zinc-500">No customers visited.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 text-sm">
              {shops.map((s) => (
                <li key={s.id} className="py-2">
                  {s.name}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Orders (${orders.length})`}>
          {orders.length === 0 ? (
            <p className="text-sm text-zinc-500">No orders.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {orders.map((o) => (
                <div key={o.id} className="rounded-xl border border-zinc-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <span className="font-medium">{o.shop.name}</span>
                      <div className="text-xs text-zinc-500">
                        {new Date(o.createdAt).toLocaleTimeString()} · {o.paymentType.toUpperCase()}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold">{o.total.toFixed(2)}</span>
                      <div className="mt-1 flex flex-wrap items-center justify-end gap-1">
                        <StatusBadge status={o.status} />
                        {o.status === "dispatched" && (
                          <MessagePill status={o.messageStatus} reason={o.messageReason} />
                        )}
                      </div>
                    </div>
                  </div>
                  <ul className="mt-2 text-xs text-zinc-600">
                    {o.items.map((it) => (
                      <li key={it.id}>
                        {it.productName} × {it.quantity} = {it.lineTotal.toFixed(2)}
                      </li>
                    ))}
                  </ul>
                  {o.status === "approved" && (
                    <div className="mt-2 flex justify-end">
                      <Button
                        onClick={() => dispatchOrder(o.id)}
                        disabled={dispatchingId === o.id}
                        className="h-8 px-3 text-xs"
                      >
                        {dispatchingId === o.id ? "Dispatching…" : "Dispatch & notify customer"}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title={`Collections (${payments.length})`}>
          {payments.length === 0 ? (
            <p className="text-sm text-zinc-500">No collections.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium">{p.customerName}</div>
                    <div className="text-xs text-zinc-500">
                      {p.method} {p.shop ? `· ${p.shop.name}` : ""}
                    </div>
                  </div>
                  <div className="font-semibold">{p.amount.toFixed(2)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Visits (${visits.length})`}>
          {visits.length === 0 ? (
            <p className="text-sm text-zinc-500">No visits logged.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 text-sm">
              {visits.map((v) => (
                <li key={v.id} className="py-2">
                  <div className="flex justify-between">
                    <span className="font-medium">{v.shop.name}</span>
                    <span className="text-xs text-zinc-500">
                      {new Date(v.visitDate).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {v.customerType === "new_customer" ? "New customer" : "Existing customer"}
                    {v.notes ? ` · ${v.notes}` : ""}
                  </div>
                  {v.products && v.products.length > 0 && (
                    <ul className="mt-1 text-xs text-zinc-600">
                      {v.products.map((vp) => (
                        <li key={vp.id}>
                          • {vp.productName}
                          {vp.offeredPrice != null ? ` @ ${vp.offeredPrice.toFixed(2)}` : ""}
                          {vp.interest ? ` — ${vp.interest}` : ""}
                          {vp.discussion ? ` · ${vp.discussion}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-900">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, string> = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-rose-100 text-rose-800",
    dispatched: "bg-indigo-100 text-indigo-800",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${map[status]}`}>
      {status}
    </span>
  );
}

function MessagePill({
  status,
  reason,
}: {
  status: MessageStatus;
  reason: string | null;
}) {
  if (status === "not_attempted") return null;
  const isOk = status === "link_opened";
  const cls = isOk ? "bg-indigo-50 text-indigo-700" : "bg-red-50 text-red-700";
  const label = isOk ? "✓ message link opened" : "⚠ phone invalid";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] ${cls}`} title={reason ?? ""}>
      {label}
    </span>
  );
}
