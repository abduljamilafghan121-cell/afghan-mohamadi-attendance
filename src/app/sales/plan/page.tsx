"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "../../../components/AppShell";
import { WorkdayBanner } from "../../../components/WorkdayBanner";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { apiFetch } from "../../../lib/clientApi";
import { getToken } from "../../../lib/clientAuth";

type Plan = {
  id: string;
  shopId: string;
  plannedDate: string;
  notes: string | null;
  status: "pending" | "done" | "missed" | "cancelled";
  source: "template" | "manual";
  shop: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    region: { name: string } | null;
  };
  visit: { id: string; visitDate: string } | null;
};

type VisitProduct = {
  id: string;
  productName: string;
  offeredPrice: number | null;
  discussion: string | null;
  interest: string | null;
};
type OrderItem = {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};
type PlanDetail = {
  plan: {
    id: string;
    plannedDate: string;
    status: string;
    source: string;
    notes: string | null;
    user: { id: string; name: string };
    shop: {
      id: string;
      name: string;
      address: string | null;
      phone: string | null;
      region: { name: string } | null;
    };
    visit: {
      id: string;
      visitDate: string;
      customerType: string;
      notes: string | null;
      gpsLat: number | null;
      gpsLng: number | null;
      products: VisitProduct[];
    } | null;
  };
  orders: {
    id: string;
    createdAt: string;
    total: number;
    paymentType: string;
    status: string;
    notes: string | null;
    items: OrderItem[];
  }[];
  payments: {
    id: string;
    createdAt: string;
    customerName: string;
    amount: number;
    method: string;
    notes: string | null;
  }[];
};

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_STYLE: Record<Plan["status"], string> = {
  pending: "bg-amber-50 text-amber-700",
  done: "bg-emerald-50 text-emerald-700",
  missed: "bg-rose-50 text-rose-700",
  cancelled: "bg-zinc-100 text-zinc-600",
};

export default function MyPlanPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const today = ymd(new Date());
  const [date, setDate] = useState(today);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    pending: number;
    done: number;
    missed: number;
    cancelled: number;
  } | null>(null);
  const [outstation, setOutstation] = useState<{
    startDate: string;
    endDate: string;
    reason: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [detailPlan, setDetailPlan] = useState<PlanDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiFetch<{ plans: Plan[]; summary: any; outstation: any }>(`/api/sales/my-plan?date=${date}`);
      setPlans(r.plans);
      setSummary(r.summary);
      setOutstation(r.outstation ?? null);
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

  const openDetail = async (planId: string) => {
    setDetailPlan(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const r = await apiFetch<PlanDetail>(`/api/sales/plan-detail/${planId}`);
      setDetailPlan(r);
    } catch (e: any) {
      setDetailError(e?.message ?? "Failed to load details");
    } finally {
      setDetailLoading(false);
    }
  };

  const shift = (days: number) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + days);
    setDate(ymd(d));
  };

  const isToday = date === today;

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-zinc-900">My Plan</h1>
          <Link href="/sales" className="text-sm text-zinc-600 hover:underline">
            ← Sales
          </Link>
        </div>

        <WorkdayBanner />

        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => shift(-1)} className="h-9 px-3 text-sm">
              ← Prev
            </Button>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-auto"
            />
            <Button variant="secondary" onClick={() => shift(1)} className="h-9 px-3 text-sm">
              Next →
            </Button>
            {!isToday && (
              <Button
                variant="secondary"
                onClick={() => setDate(today)}
                className="h-9 px-3 text-sm"
              >
                Today
              </Button>
            )}
          </div>

          {summary && (
            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-sm">
              <Stat label="Total" value={summary.total} />
              <Stat label="Pending" value={summary.pending} tone="amber" />
              <Stat label="Done" value={summary.done} tone="emerald" />
              <Stat label="Missed" value={summary.missed} tone="rose" />
            </div>
          )}
        </Card>

        {outstation && (
          <Card>
            <div className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800">
              <div className="font-semibold">Outstation</div>
              <div>
                {new Date(outstation.startDate).toLocaleDateString()} –{" "}
                {new Date(outstation.endDate).toLocaleDateString()}
                {outstation.reason ? ` · ${outstation.reason}` : ""}
              </div>
              <div className="mt-1 text-xs text-sky-700">
                Plans for these days are auto-cancelled and won't count as missed.
              </div>
            </div>
          </Card>
        )}

        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="space-y-3">
          {loading && <div className="text-sm text-zinc-500">Loading…</div>}
          {!loading && plans.length === 0 && (
            <Card>
              <div className="py-6 text-center text-sm text-zinc-500">
                No visits planned for this day.
              </div>
            </Card>
          )}
          {plans.map((p) => (
            <Card key={p.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-zinc-900">{p.shop.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[p.status]}`}>
                      {p.status}
                    </span>
                    {p.shop.region && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                        {p.shop.region.name}
                      </span>
                    )}
                    <span className="rounded-full bg-zinc-50 px-2 py-0.5 text-xs text-zinc-500">
                      {p.source === "template" ? "Weekly" : "One-off"}
                    </span>
                  </div>
                  {p.shop.address && (
                    <div className="mt-1 text-sm text-zinc-600">{p.shop.address}</div>
                  )}
                  {p.shop.phone && (
                    <div className="text-sm text-zinc-600">{p.shop.phone}</div>
                  )}
                  {p.notes && (
                    <div className="mt-2 rounded-lg bg-zinc-50 p-2 text-sm text-zinc-700">
                      <span className="text-xs font-semibold text-zinc-500">Note: </span>
                      {p.notes}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {p.status === "pending" && isToday && (
                    <Link
                      href={`/sales/visits/new?shopId=${encodeURIComponent(p.shopId)}&planId=${encodeURIComponent(p.id)}`}
                    >
                      <Button className="h-9 px-3 text-sm">Log Visit</Button>
                    </Link>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => openDetail(p.id)}
                    className="h-9 px-3 text-sm"
                  >
                    Details
                  </Button>
                  {p.status === "done" && p.visit && (
                    <span className="text-xs text-emerald-700">
                      Logged at {new Date(p.visit.visitDate).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {(detailPlan || detailLoading || detailError) && (
        <PlanDetailModal
          data={detailPlan}
          loading={detailLoading}
          error={detailError}
          onClose={() => { setDetailPlan(null); setDetailError(null); }}
        />
      )}
    </AppShell>
  );
}

function PlanDetailModal({
  data,
  loading,
  error,
  onClose,
}: {
  data: PlanDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const statusStyle: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700",
    done: "bg-emerald-50 text-emerald-700",
    missed: "bg-rose-50 text-rose-700",
    cancelled: "bg-zinc-100 text-zinc-600",
    approved: "bg-emerald-50 text-emerald-700",
    rejected: "bg-rose-50 text-rose-700",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-900">Plan Details</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading && <div className="py-8 text-center text-sm text-zinc-500">Loading…</div>}
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          {data && (
            <>
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Plan Info</h3>
                <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 space-y-1 text-sm">
                  <Row label="Date" value={new Date(data.plan.plannedDate).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })} />
                  <Row label="Customer" value={data.plan.shop.name} />
                  {data.plan.shop.address && <Row label="Address" value={data.plan.shop.address} />}
                  {data.plan.shop.phone && <Row label="Phone" value={data.plan.shop.phone} />}
                  {data.plan.shop.region && <Row label="Region" value={data.plan.shop.region.name} />}
                  <Row label="Source" value={data.plan.source === "template" ? "Weekly Template" : "One-off"} />
                  <div className="flex gap-2 pt-1">
                    <span className="text-xs font-medium text-zinc-500 w-28">Status</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusStyle[data.plan.status] ?? "bg-zinc-100 text-zinc-700"}`}>
                      {data.plan.status}
                    </span>
                  </div>
                  {data.plan.notes && <Row label="Notes" value={data.plan.notes} />}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Visit {data.plan.visit ? `— logged at ${new Date(data.plan.visit.visitDate).toLocaleTimeString()}` : ""}
                </h3>
                {data.plan.visit ? (
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 space-y-2 text-sm">
                    <Row label="Logged At" value={new Date(data.plan.visit.visitDate).toLocaleString()} />
                    <Row label="Customer Type" value={data.plan.visit.customerType === "new_customer" ? "New Customer" : "Existing Customer"} />
                    {data.plan.visit.notes && <Row label="Notes" value={data.plan.visit.notes} />}
                    {data.plan.visit.gpsLat != null && data.plan.visit.gpsLng != null && (
                      <Row label="GPS" value={`${data.plan.visit.gpsLat.toFixed(5)}, ${data.plan.visit.gpsLng.toFixed(5)}`} />
                    )}
                    {data.plan.visit.products.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-zinc-500 mb-1">Products Discussed</div>
                        <ul className="space-y-1">
                          {data.plan.visit.products.map((p) => (
                            <li key={p.id} className="rounded-lg border border-zinc-200 bg-white p-2 text-xs text-zinc-700">
                              <span className="font-medium">{p.productName}</span>
                              {p.offeredPrice != null && <span className="ml-2 text-zinc-500">@ {p.offeredPrice.toFixed(2)}</span>}
                              {p.interest && <span className="ml-2 italic text-zinc-500">{p.interest}</span>}
                              {p.discussion && <div className="mt-0.5 text-zinc-400">{p.discussion}</div>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {data.plan.visit.products.length === 0 && (
                      <div className="text-xs text-zinc-400">No products discussed</div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-400">
                    No visit logged for this plan yet.
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Orders ({data.orders.length})
                </h3>
                {data.orders.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-400">
                    No orders placed on this day for this customer.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.orders.map((o) => (
                      <div key={o.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-sm space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-zinc-800">{new Date(o.createdAt).toLocaleTimeString()}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs capitalize text-zinc-500">{o.paymentType}</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs ${statusStyle[o.status] ?? "bg-zinc-100 text-zinc-700"}`}>{o.status}</span>
                            <span className="font-semibold text-zinc-900">{o.total.toFixed(2)}</span>
                          </div>
                        </div>
                        {o.notes && <div className="text-xs text-zinc-500">{o.notes}</div>}
                        <ul className="mt-1 space-y-0.5">
                          {o.items.map((item) => (
                            <li key={item.id} className="flex justify-between text-xs text-zinc-600">
                              <span>{item.productName} × {item.quantity}</span>
                              <span>{item.lineTotal.toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    <div className="text-right text-sm font-semibold text-zinc-800">
                      Total: {data.orders.reduce((s, o) => s + o.total, 0).toFixed(2)}
                    </div>
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Collections ({data.payments.length})
                </h3>
                {data.payments.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-400">
                    No collections recorded on this day for this customer.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.payments.map((p) => (
                      <div key={p.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-sm space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-zinc-800">{new Date(p.createdAt).toLocaleTimeString()}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs capitalize text-zinc-500">{p.method.replace("_", " ")}</span>
                            <span className="font-semibold text-zinc-900">{p.amount.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="text-xs text-zinc-500">Received from: {p.customerName}</div>
                        {p.notes && <div className="text-xs text-zinc-400">{p.notes}</div>}
                      </div>
                    ))}
                    <div className="text-right text-sm font-semibold text-zinc-800">
                      Total: {data.payments.reduce((s, p) => s + p.amount, 0).toFixed(2)}
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <div className="border-t border-zinc-100 px-5 py-3 flex justify-end">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-xs font-medium text-zinc-500 w-28 shrink-0">{label}</span>
      <span className="text-zinc-700">{value}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "amber" | "emerald" | "rose";
}) {
  const cls =
    tone === "amber"
      ? "bg-amber-50 text-amber-800"
      : tone === "emerald"
        ? "bg-emerald-50 text-emerald-800"
        : tone === "rose"
          ? "bg-rose-50 text-rose-800"
          : "bg-zinc-50 text-zinc-800";
  return (
    <div className={`rounded-xl px-3 py-2 ${cls}`}>
      <div className="text-[11px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}
