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
import { downloadTextFile } from "../../../../lib/exportUtils";

type Summary = {
  totalSales: number;
  cashSales: number;
  creditSales: number;
  totalCollections: number;
  ordersCount: number;
  visitsCount: number;
  paymentsCount: number;
};
type Order = {
  id: string;
  createdAt: string;
  total: number;
  paymentType: string;
  user: { id: string; name: string };
  shop: { id: string; name: string };
  items: { productName: string; quantity: number; lineTotal: number }[];
};
type Payment = {
  id: string;
  createdAt: string;
  customerName: string;
  amount: number;
  method: string;
  user: { id: string; name: string };
  shop: { id: string; name: string } | null;
};
type VisitProduct = {
  id: string;
  productName: string;
  offeredPrice: number | null;
  discussion: string | null;
  interest: string | null;
};
type Visit = {
  id: string;
  visitDate: string;
  customerType: string;
  notes: string | null;
  user: { id: string; name: string };
  shop: { id: string; name: string };
  products: VisitProduct[];
};
type U = { id: string; name: string };

function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function csvEscape(v: any) {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function AdminSalesReportsPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);
  const [from, setFrom] = useState(todayStr(-7));
  const [to, setTo] = useState(todayStr());
  const [userId, setUserId] = useState("");
  const [users, setUsers] = useState<U[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
    if (user && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ users: U[] }>("/api/admin/sales/users")
      .then((r) => setUsers(r.users))
      .catch(() => {});
  }, [token]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      if (userId) params.set("userId", userId);
      const r = await apiFetch<{
        summary: Summary;
        orders: Order[];
        payments: Payment[];
        visits: Visit[];
      }>(`/api/admin/sales/reports?${params.toString()}`);
      setSummary(r.summary);
      setOrders(r.orders);
      setPayments(r.payments);
      setVisits(r.visits);
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const exportOrdersCsv = async () => {
    const header = ["Date", "Salesman", "Customer", "Total", "Payment", "Items"].join(",");
    const rows = orders.map((o) =>
      [
        new Date(o.createdAt).toISOString(),
        o.user.name,
        o.shop.name,
        o.total.toFixed(2),
        o.paymentType,
        o.items.map((i) => `${i.productName} x${i.quantity}`).join(" | "),
      ]
        .map(csvEscape)
        .join(","),
    );
    await downloadTextFile(`sales-orders-${from}-to-${to}.csv`, [header, ...rows].join("\n"), "text/csv");
  };

  const exportPaymentsCsv = async () => {
    const header = ["Date", "Salesman", "Received From", "Customer", "Amount", "Method"].join(",");
    const rows = payments.map((p) =>
      [
        new Date(p.createdAt).toISOString(),
        p.user.name,
        p.customerName,
        p.shop?.name ?? "",
        p.amount.toFixed(2),
        p.method,
      ]
        .map(csvEscape)
        .join(","),
    );
    await downloadTextFile(`sales-collections-${from}-to-${to}.csv`, [header, ...rows].join("\n"), "text/csv");
  };

  const exportVisitsCsv = async () => {
    const header = ["Date", "Salesman", "Customer", "CustomerType", "Notes", "Products Discussed"].join(",");
    const rows = visits.map((v) =>
      [
        new Date(v.visitDate).toISOString(),
        v.user.name,
        v.shop.name,
        v.customerType,
        v.notes ?? "",
        (v.products ?? [])
          .map((p) => {
            const parts = [p.productName];
            if (p.offeredPrice != null) parts.push(`@${p.offeredPrice.toFixed(2)}`);
            if (p.interest) parts.push(`interest:${p.interest}`);
            if (p.discussion) parts.push(p.discussion);
            return parts.join(" ");
          })
          .join(" | "),
      ]
        .map(csvEscape)
        .join(","),
    );
    await downloadTextFile(`sales-visits-${from}-to-${to}.csv`, [header, ...rows].join("\n"), "text/csv");
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-zinc-900">Sales Reports</h1>
          <Link href="/admin/sales/dashboard" className="text-sm text-zinc-600 hover:underline">
            ← Dashboard
          </Link>
        </div>

        <Card>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Salesman</label>
              <Combobox
                options={users.map((u) => ({ id: u.id, label: u.name }))}
                value={userId}
                onChange={setUserId}
                placeholder="All salesmen"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={load} disabled={loading} className="w-full">
                {loading ? "Loading…" : "Apply"}
              </Button>
            </div>
          </div>
        </Card>

        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Total Sales" value={summary.totalSales.toFixed(2)} />
            <Stat label="Cash Sales" value={summary.cashSales.toFixed(2)} />
            <Stat label="Credit Sales" value={summary.creditSales.toFixed(2)} />
            <Stat label="Collections" value={summary.totalCollections.toFixed(2)} />
            <Stat label="Orders" value={summary.ordersCount} />
            <Stat label="Visits" value={summary.visitsCount} />
          </div>
        )}

        <Card title={`Orders (${orders.length})`}>
          <div className="mb-2 flex justify-end">
            <Button variant="secondary" onClick={exportOrdersCsv} disabled={orders.length === 0}>
              Export CSV
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-zinc-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Salesman</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Payment</th>
                  <th className="py-2 pr-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2 pr-3">{new Date(o.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-3">{o.user.name}</td>
                    <td className="py-2 pr-3">{o.shop.name}</td>
                    <td className="py-2 pr-3 capitalize">{o.paymentType}</td>
                    <td className="py-2 pr-3 text-right">{o.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title={`Collections (${payments.length})`}>
          <div className="mb-2 flex justify-end">
            <Button variant="secondary" onClick={exportPaymentsCsv} disabled={payments.length === 0}>
              Export CSV
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-zinc-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Salesman</th>
                  <th className="py-2 pr-3">Received From</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Method</th>
                  <th className="py-2 pr-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-3">{new Date(p.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-3">{p.user.name}</td>
                    <td className="py-2 pr-3">{p.customerName}</td>
                    <td className="py-2 pr-3">{p.shop?.name ?? "—"}</td>
                    <td className="py-2 pr-3 capitalize">{p.method.replace("_", " ")}</td>
                    <td className="py-2 pr-3 text-right">{p.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title={`Visits (${visits.length})`}>
          <div className="mb-2 flex justify-end">
            <Button variant="secondary" onClick={exportVisitsCsv} disabled={visits.length === 0}>
              Export CSV
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-zinc-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Salesman</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Notes</th>
                  <th className="py-2 pr-3">Products discussed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {visits.map((v) => (
                  <tr key={v.id} className="align-top">
                    <td className="py-2 pr-3">{new Date(v.visitDate).toLocaleString()}</td>
                    <td className="py-2 pr-3">{v.user.name}</td>
                    <td className="py-2 pr-3">{v.shop.name}</td>
                    <td className="py-2 pr-3">{v.customerType === "new_customer" ? "New" : "Existing"}</td>
                    <td className="py-2 pr-3">{v.notes ?? ""}</td>
                    <td className="py-2 pr-3">
                      {v.products && v.products.length > 0 ? (
                        <ul className="space-y-0.5 text-xs text-zinc-700">
                          {v.products.map((p) => (
                            <li key={p.id}>
                              • {p.productName}
                              {p.offeredPrice != null ? ` @ ${p.offeredPrice.toFixed(2)}` : ""}
                              {p.interest ? ` — ${p.interest}` : ""}
                              {p.discussion ? ` · ${p.discussion}` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-zinc-900">{value}</div>
    </div>
  );
}
