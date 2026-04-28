"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../components/AppShell";
import { WorkdayBanner } from "../../components/WorkdayBanner";
import { Card } from "../../components/ui/Card";
import { apiFetch } from "../../lib/clientApi";
import { getToken, parseJwt } from "../../lib/clientAuth";

type Summary = {
  totalVisits: number;
  totalOrdersValue: number;
  cashOrders: number;
  creditOrders: number;
  totalCollections: number;
  ordersCount: number;
  shopsCount: number;
};

const tiles = [
  { href: "/sales/plan", label: "My Plan", desc: "Today's planned visits", color: "bg-sky-50 border-sky-200 text-sky-900" },
  { href: "/sales/visits/new", label: "Add Visit", desc: "Log a customer visit", color: "bg-blue-50 border-blue-200 text-blue-900" },
  { href: "/sales/orders/new", label: "New Order", desc: "Place a customer order", color: "bg-emerald-50 border-emerald-200 text-emerald-900" },
  { href: "/sales/dispatch", label: "Pending Dispatch", desc: "Approved orders awaiting customer notification", color: "bg-indigo-50 border-indigo-200 text-indigo-900" },
  { href: "/sales/payments/new", label: "Add Collection", desc: "Record a payment received", color: "bg-amber-50 border-amber-200 text-amber-900" },
  { href: "/sales/customers", label: "Customers", desc: "Search & view full history", color: "bg-rose-50 border-rose-200 text-rose-900" },
  { href: "/sales/report", label: "My Daily Report", desc: "Today's totals & visits", color: "bg-violet-50 border-violet-200 text-violet-900" },
  { href: "/sales/outstation", label: "Outstation", desc: "Request travel days off-base", color: "bg-cyan-50 border-cyan-200 text-cyan-900" },
];

export default function SalesHomePage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ summary: Summary }>("/api/sales/my-report")
      .then((r) => setSummary(r.summary))
      .catch(() => setSummary(null));
  }, [token]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Sales</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Track customer visits, orders, and collections.
          </p>
        </div>

        <WorkdayBanner />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`rounded-2xl border p-5 transition active:scale-[0.98] ${t.color}`}
            >
              <div className="text-base font-semibold">{t.label}</div>
              <div className="mt-1 text-sm opacity-80">{t.desc}</div>
            </Link>
          ))}
        </div>

        <Card title="Today at a glance">
          {summary ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Visits" value={summary.totalVisits} />
              <Stat label="Orders" value={summary.ordersCount} />
              <Stat label="Sales Value" value={summary.totalOrdersValue.toFixed(2)} />
              <Stat label="Collections" value={summary.totalCollections.toFixed(2)} />
              <Stat label="Cash" value={summary.cashOrders.toFixed(2)} />
              <Stat label="Credit" value={summary.creditOrders.toFixed(2)} />
              <Stat label="Customers Visited" value={summary.shopsCount} />
            </div>
          ) : (
            <div className="text-sm text-zinc-500">Loading…</div>
          )}
        </Card>

        {user?.role === "admin" && (
          <Card title="Admin shortcuts">
            <div className="flex flex-wrap gap-2 text-sm">
              <Link className="rounded-lg border border-zinc-200 px-3 py-2 hover:bg-zinc-50" href="/admin/sales/dashboard">
                Sales Dashboard
              </Link>
              <Link className="rounded-lg border border-zinc-200 px-3 py-2 hover:bg-zinc-50" href="/admin/sales/reports">
                Reports
              </Link>
              <Link className="rounded-lg border border-zinc-200 px-3 py-2 hover:bg-zinc-50" href="/admin/sales/products">
                Products
              </Link>
            </div>
          </Card>
        )}
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
