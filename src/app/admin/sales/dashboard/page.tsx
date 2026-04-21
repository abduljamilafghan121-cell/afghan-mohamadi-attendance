"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "../../../../components/AppShell";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { apiFetch } from "../../../../lib/clientApi";
import { getToken, parseJwt } from "../../../../lib/clientAuth";

type Summary = {
  totalSales: number;
  cashSales: number;
  creditSales: number;
  totalCollections: number;
  ordersCount: number;
  visitsCount: number;
};
type Row = {
  id: string;
  name: string;
  sales: number;
  collections: number;
  visits: number;
  orders: number;
};

function todayStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export default function AdminSalesDashboard() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);
  const [date, setDate] = useState(todayStr());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [perEmployee, setPerEmployee] = useState<Row[]>([]);
  const [topPerformers, setTopPerformers] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
    if (user && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch<{
        summary: Summary;
        perEmployee: Row[];
        topPerformers: Row[];
      }>(`/api/admin/sales/dashboard?date=${date}`);
      setSummary(r.summary);
      setPerEmployee(r.perEmployee);
      setTopPerformers(r.topPerformers);
    } catch (e: any) {
      setError(e?.message ?? "Failed");
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
          <h1 className="text-xl font-semibold text-zinc-900">Sales Dashboard</h1>
          <div className="flex gap-2">
            <Link
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
              href="/admin/sales/reports"
            >
              Reports
            </Link>
            <Link
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
              href="/admin/sales/products"
            >
              Products
            </Link>
          </div>
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Total Sales" value={summary.totalSales.toFixed(2)} color="bg-emerald-50 text-emerald-700" />
            <StatCard label="Cash Sales" value={summary.cashSales.toFixed(2)} color="bg-blue-50 text-blue-700" />
            <StatCard label="Credit Sales" value={summary.creditSales.toFixed(2)} color="bg-amber-50 text-amber-700" />
            <StatCard label="Collections" value={summary.totalCollections.toFixed(2)} color="bg-violet-50 text-violet-700" />
            <StatCard label="Orders" value={summary.ordersCount} color="bg-zinc-50 text-zinc-700" />
            <StatCard label="Visits" value={summary.visitsCount} color="bg-zinc-50 text-zinc-700" />
          </div>
        )}

        <Card title="Top performers (by sales)">
          {topPerformers.length === 0 ? (
            <p className="text-sm text-zinc-500">No sales recorded.</p>
          ) : (
            <ol className="divide-y divide-zinc-100 text-sm">
              {topPerformers.map((r, i) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <span>
                    {i + 1}. {r.name}
                  </span>
                  <span className="font-semibold">{r.sales.toFixed(2)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card title="Per-employee">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">Employee</th>
                  <th className="py-2 pr-3">Visits</th>
                  <th className="py-2 pr-3">Orders</th>
                  <th className="py-2 pr-3">Sales</th>
                  <th className="py-2 pr-3">Collections</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {perEmployee.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-3">{r.name}</td>
                    <td className="py-2 pr-3">{r.visits}</td>
                    <td className="py-2 pr-3">{r.orders}</td>
                    <td className="py-2 pr-3">{r.sales.toFixed(2)}</td>
                    <td className="py-2 pr-3">{r.collections.toFixed(2)}</td>
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

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`rounded-2xl border border-zinc-200 p-4 ${color}`}>
      <div className="text-[11px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
