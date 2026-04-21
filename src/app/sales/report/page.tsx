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
type Order = { id: string; createdAt: string; total: number; paymentType: string; shop: { id: string; name: string }; items: OrderItem[] };
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

        {summary && (
          <Card title="Summary">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Visits" value={summary.totalVisits} />
              <Stat label="Orders" value={summary.ordersCount} />
              <Stat label="Sales Value" value={summary.totalOrdersValue.toFixed(2)} />
              <Stat label="Collections" value={summary.totalCollections.toFixed(2)} />
              <Stat label="Cash Orders" value={summary.cashOrders.toFixed(2)} />
              <Stat label="Credit Orders" value={summary.creditOrders.toFixed(2)} />
              <Stat label="Shops Visited" value={summary.shopsCount} />
            </div>
          </Card>
        )}

        <Card title={`Shops visited (${shops.length})`}>
          {shops.length === 0 ? (
            <p className="text-sm text-zinc-500">No shops visited.</p>
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
                  <div className="flex justify-between">
                    <span className="font-medium">{o.shop.name}</span>
                    <span className="font-semibold">{o.total.toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {new Date(o.createdAt).toLocaleTimeString()} · {o.paymentType.toUpperCase()}
                  </div>
                  <ul className="mt-2 text-xs text-zinc-600">
                    {o.items.map((it) => (
                      <li key={it.id}>
                        {it.productName} × {it.quantity} = {it.lineTotal.toFixed(2)}
                      </li>
                    ))}
                  </ul>
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
