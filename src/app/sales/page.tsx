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
  {
    href: "/sales/plan", label: "My Plan", desc: "Today's planned visits",
    color: "bg-sky-50 border-sky-200 text-sky-900 hover:bg-sky-100",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  },
  {
    href: "/sales/visits/new", label: "Add Visit", desc: "Log a customer visit",
    color: "bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  },
  {
    href: "/sales/orders/new", label: "New Order", desc: "Place a customer order",
    color: "bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  },
  {
    href: "/sales/dispatch", label: "Pending Dispatch", desc: "Orders awaiting dispatch",
    color: "bg-indigo-50 border-indigo-200 text-indigo-900 hover:bg-indigo-100",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  },
  {
    href: "/sales/payments/new", label: "Add Collection", desc: "Record a payment received",
    color: "bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  },
  {
    href: "/sales/customers", label: "Customers", desc: "Search & view full history",
    color: "bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  {
    href: "/sales/report", label: "My Daily Report", desc: "Today's totals & visits",
    color: "bg-violet-50 border-violet-200 text-violet-900 hover:bg-violet-100",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  },
  {
    href: "/sales/outstation", label: "Outstation", desc: "Request travel days off-base",
    color: "bg-cyan-50 border-cyan-200 text-cyan-900 hover:bg-cyan-100",
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.36 12 19.79 19.79 0 0 1 1.21 3.54 2 2 0 0 1 3.22 1.36h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z"/></svg>,
  },
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
              className={`group flex flex-col gap-3 rounded-2xl border p-5 transition-all active:scale-[0.97] ${t.color}`}
            >
              <div className="flex items-center justify-between">
                <div className="opacity-70">{t.icon}</div>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="opacity-30 group-hover:opacity-60 transition-opacity"><polyline points="6,3 11,8 6,13"/></svg>
              </div>
              <div>
                <div className="font-semibold text-[15px]">{t.label}</div>
                <div className="mt-0.5 text-xs opacity-70 leading-snug">{t.desc}</div>
              </div>
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
