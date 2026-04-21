"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "../../../../components/AppShell";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { apiFetch } from "../../../../lib/clientApi";
import { getToken, parseJwt } from "../../../../lib/clientAuth";

type Customer = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
};
type Summary = {
  visitsCount: number;
  ordersCount: number;
  paymentsCount: number;
  totalSales: number;
  cashSales: number;
  creditSales: number;
  totalCollections: number;
  outstanding: number;
  lastVisit: string | null;
  lastOrder: string | null;
  lastPayment: string | null;
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
  products: VisitProduct[];
};
type OrderItem = {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};
type Order = {
  id: string;
  createdAt: string;
  total: number;
  paymentType: string;
  notes: string | null;
  user: { id: string; name: string };
  items: OrderItem[];
};
type Payment = {
  id: string;
  createdAt: string;
  customerName: string;
  amount: number;
  method: string;
  notes: string | null;
  user: { id: string; name: string };
};
type TimelineEntry =
  | { kind: "visit"; at: string; data: Visit }
  | { kind: "order"; at: string; data: Order }
  | { kind: "payment"; at: string; data: Payment };

function fmtDateTime(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString();
}

export default function CustomerHistoryPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);
  const isAdmin = user?.role === "admin";
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "visit" | "order" | "payment">("all");

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const load = async () => {
    if (!params?.id) return;
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch<{
        customer: Customer;
        summary: Summary;
        timeline: TimelineEntry[];
      }>(`/api/sales/customers/${params.id}/history?scope=${scope}`);
      setCustomer(r.customer);
      setSummary(r.summary);
      setTimeline(r.timeline);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, params?.id, scope]);

  const visible = useMemo(
    () => (filter === "all" ? timeline : timeline.filter((t) => t.kind === filter)),
    [timeline, filter],
  );

  const mapsHref = customer?.gpsLat != null && customer?.gpsLng != null
    ? `https://maps.google.com/?q=${customer.gpsLat},${customer.gpsLng}`
    : null;

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-zinc-900">
            {customer?.name ?? "Customer"}
          </h1>
          <Link href="/sales/customers" className="text-sm text-zinc-600 hover:underline">
            ← All customers
          </Link>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {customer && (
          <Card>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase text-zinc-500">Address</div>
                <div className="text-zinc-800">{customer.address || "—"}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-zinc-500">Phone</div>
                <div className="text-zinc-800">
                  {customer.phone ? (
                    <a href={`tel:${customer.phone}`} className="underline">
                      {customer.phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
              {mapsHref && (
                <div className="sm:col-span-2">
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block rounded-lg border border-zinc-200 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                  >
                    📍 Open location in Maps
                  </a>
                </div>
              )}
            </div>
          </Card>
        )}

        {summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Visits" value={summary.visitsCount} />
            <Stat label="Orders" value={summary.ordersCount} />
            <Stat label="Sales Value" value={summary.totalSales.toFixed(2)} />
            <Stat label="Collections" value={summary.totalCollections.toFixed(2)} />
            <Stat label="Cash Sales" value={summary.cashSales.toFixed(2)} />
            <Stat label="Credit Sales" value={summary.creditSales.toFixed(2)} />
            <Stat
              label="Outstanding"
              value={summary.outstanding.toFixed(2)}
              accent={summary.outstanding > 0 ? "text-amber-700 bg-amber-50" : undefined}
            />
            <Stat label="Last visit" value={fmtDateTime(summary.lastVisit)} />
          </div>
        )}

        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase text-zinc-500">Show</span>
            {(["all", "visit", "order", "payment"] as const).map((k) => (
              <Button
                key={k}
                type="button"
                variant={filter === k ? "primary" : "secondary"}
                onClick={() => setFilter(k)}
              >
                {k === "all" ? "All" : k === "visit" ? "Visits" : k === "order" ? "Orders" : "Collections"}
              </Button>
            ))}
            {isAdmin && (
              <div className="ml-auto flex items-center gap-1">
                <span className="text-xs uppercase text-zinc-500">Scope</span>
                <Button
                  type="button"
                  variant={scope === "mine" ? "primary" : "secondary"}
                  onClick={() => setScope("mine")}
                >
                  Mine
                </Button>
                <Button
                  type="button"
                  variant={scope === "all" ? "primary" : "secondary"}
                  onClick={() => setScope("all")}
                >
                  All salesmen
                </Button>
              </div>
            )}
          </div>
        </Card>

        <Card title="Timeline">
          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-zinc-500">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {visible.map((entry) => (
                <li key={`${entry.kind}-${entry.data.id}`}>
                  {entry.kind === "visit" && <VisitRow v={entry.data as Visit} />}
                  {entry.kind === "order" && <OrderRow o={entry.data as Order} />}
                  {entry.kind === "payment" && <PaymentRow p={entry.data as Payment} />}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <div className={`rounded-xl border border-zinc-200 p-3 ${accent ?? "bg-white"}`}>
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-base font-semibold text-zinc-900">{value}</div>
    </div>
  );
}

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${color}`}>
      {children}
    </span>
  );
}

function VisitRow({ v }: { v: Visit }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Pill color="bg-blue-50 text-blue-700">Visit</Pill>
          <span className="text-xs text-zinc-500">{fmtDateTime(v.visitDate)}</span>
        </div>
        <span className="text-xs text-zinc-500">{v.user.name}</span>
      </div>
      <div className="mt-1 text-xs text-zinc-600">
        {v.customerType === "new_customer" ? "New customer" : "Existing customer"}
        {v.notes ? ` · ${v.notes}` : ""}
      </div>
      {v.products && v.products.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-zinc-700">
          {v.products.map((p) => (
            <li key={p.id}>
              • {p.productName}
              {p.offeredPrice != null ? ` @ ${p.offeredPrice.toFixed(2)}` : ""}
              {p.interest ? ` — ${p.interest}` : ""}
              {p.discussion ? ` · ${p.discussion}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderRow({ o }: { o: Order }) {
  const isCredit = o.paymentType === "credit";
  return (
    <div className="rounded-xl border border-zinc-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Pill color="bg-emerald-50 text-emerald-700">Order</Pill>
          <span className="text-xs text-zinc-500">{fmtDateTime(o.createdAt)}</span>
          <Pill color={isCredit ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-700"}>
            {o.paymentType}
          </Pill>
        </div>
        <span className="text-sm font-semibold text-zinc-900">{o.total.toFixed(2)}</span>
      </div>
      <div className="mt-1 text-xs text-zinc-500">{o.user.name}</div>
      <ul className="mt-2 space-y-0.5 text-xs text-zinc-700">
        {o.items.map((it) => (
          <li key={it.id}>
            • {it.productName} × {it.quantity} = {it.lineTotal.toFixed(2)}
          </li>
        ))}
      </ul>
      {o.notes && <div className="mt-1 text-xs text-zinc-500">Note: {o.notes}</div>}
    </div>
  );
}

function PaymentRow({ p }: { p: Payment }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Pill color="bg-violet-50 text-violet-700">Collection</Pill>
          <span className="text-xs text-zinc-500">{fmtDateTime(p.createdAt)}</span>
          <Pill color="bg-zinc-100 text-zinc-700">{p.method.replace("_", " ")}</Pill>
        </div>
        <span className="text-sm font-semibold text-zinc-900">{p.amount.toFixed(2)}</span>
      </div>
      <div className="mt-1 text-xs text-zinc-600">
        Received from {p.customerName} · by {p.user.name}
      </div>
      {p.notes && <div className="mt-1 text-xs text-zinc-500">Note: {p.notes}</div>}
    </div>
  );
}
