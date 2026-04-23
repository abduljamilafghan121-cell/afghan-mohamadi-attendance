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

type SUser = { id: string; name: string };
type Shop = { id: string; name: string; address: string | null; regionId?: string | null };
type Plan = {
  id: string;
  userId: string;
  shopId: string;
  plannedDate: string;
  notes: string | null;
  status: "pending" | "done" | "missed" | "cancelled";
  source: "template" | "manual";
  user: { id: string; name: string };
  shop: { id: string; name: string; address: string | null; region: { name: string } | null };
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
    user: { id: string; name: string; employeeId?: string | null };
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
    reviewedBy: { name: string } | null;
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

export default function AdminPlansPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const today = ymd(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState("");

  const [users, setUsers] = useState<SUser[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [detailPlan, setDetailPlan] = useState<PlanDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [newUserId, setNewUserId] = useState("");
  const [newShopId, setNewShopId] = useState("");
  const [newDate, setNewDate] = useState(today);
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!token) router.push("/login");
    else if (user && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  const loadRefs = async () => {
    try {
      const [u, s] = await Promise.all([
        apiFetch<{ users: SUser[] }>("/api/admin/sales/users"),
        apiFetch<{ shops: Shop[] }>("/api/admin/sales/shops"),
      ]);
      setUsers(u.users);
      setShops(s.shops);
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    }
  };

  const loadPlans = async () => {
    try {
      const params = new URLSearchParams();
      params.set("from", from);
      params.set("to", to);
      if (userId) params.set("userId", userId);
      if (status) params.set("status", status);
      const r = await apiFetch<{ plans: Plan[] }>(`/api/admin/sales/plans?${params}`);
      setPlans(r.plans);
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    }
  };

  useEffect(() => {
    if (token) loadRefs();
  }, [token]);

  useEffect(() => {
    if (token) loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, from, to, userId, status]);

  const openDetail = async (planId: string) => {
    setDetailPlan(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const r = await apiFetch<PlanDetail>(`/api/admin/sales/plans/${planId}`);
      setDetailPlan(r);
    } catch (e: any) {
      setDetailError(e?.message ?? "Failed to load details");
    } finally {
      setDetailLoading(false);
    }
  };

  const createOneOff = async () => {
    setError(null);
    if (!newUserId || !newShopId || !newDate) {
      setError("Salesman, customer and date are required");
      return;
    }
    setCreating(true);
    try {
      await apiFetch("/api/admin/sales/plans", {
        method: "POST",
        body: JSON.stringify({
          userId: newUserId,
          shopId: newShopId,
          plannedDate: newDate,
          notes: newNotes || null,
        }),
      });
      setNewShopId("");
      setNewNotes("");
      await loadPlans();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setCreating(false);
    }
  };

  const setPlanStatus = async (id: string, s: Plan["status"]) => {
    try {
      await apiFetch("/api/admin/sales/plans", {
        method: "PATCH",
        body: JSON.stringify({ id, status: s }),
      });
      await loadPlans();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this plan?")) return;
    try {
      await apiFetch(`/api/admin/sales/plans?id=${id}`, { method: "DELETE" });
      await loadPlans();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    }
  };

  const totals = useMemo(() => {
    return {
      total: plans.length,
      pending: plans.filter((p) => p.status === "pending").length,
      done: plans.filter((p) => p.status === "done").length,
      missed: plans.filter((p) => p.status === "missed").length,
    };
  }, [plans]);

  const userOptions = useMemo(() => users.map((u) => ({ id: u.id, label: u.name })), [users]);
  const shopOptions = useMemo(() => shops.map((s) => ({ id: s.id, label: s.name, hint: s.address ?? undefined })), [shops]);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-zinc-900">Daily Plans</h1>
          <div className="flex gap-3 text-sm">
            <Link href="/admin/sales/weekly-plans" className="text-zinc-600 hover:underline">
              Weekly templates
            </Link>
            <Link href="/admin/sales/dashboard" className="text-zinc-600 hover:underline">
              Sales dashboard
            </Link>
          </div>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <Card title="Filters">
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
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm"
              >
                <option value="">All</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm"
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="done">Done</option>
                <option value="missed">Missed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center text-sm">
            <Stat label="Total" value={totals.total} />
            <Stat label="Pending" value={totals.pending} tone="amber" />
            <Stat label="Done" value={totals.done} tone="emerald" />
            <Stat label="Missed" value={totals.missed} tone="rose" />
          </div>
        </Card>

        <Card title="Add one-off plan">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_160px_auto]">
            <Combobox
              options={userOptions}
              value={newUserId}
              onChange={setNewUserId}
              placeholder="Salesman…"
            />
            <Combobox
              options={shopOptions}
              value={newShopId}
              onChange={setNewShopId}
              placeholder="Customer…"
            />
            <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            <Button onClick={createOneOff} disabled={creating}>
              Add
            </Button>
          </div>
          <Input
            className="mt-2"
            placeholder="Notes (optional)"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
          />
        </Card>

        <Card title={`Plans (${plans.length})`}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-zinc-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Salesman</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Region</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-3">{ymd(new Date(p.plannedDate))}</td>
                    <td className="py-2 pr-3">{p.user.name}</td>
                    <td className="py-2 pr-3">
                      <div className="font-medium text-zinc-900">{p.shop.name}</div>
                      {p.shop.address && (
                        <div className="text-xs text-zinc-500">{p.shop.address}</div>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-zinc-600">{p.shop.region?.name ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs text-zinc-500">
                      {p.source === "template" ? "Weekly" : "One-off"}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-1 text-xs ${STATUS_STYLE[p.status]}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="secondary"
                          onClick={() => openDetail(p.id)}
                          className="h-8 px-3 text-xs"
                        >
                          Details
                        </Button>
                        {p.status === "pending" && (
                          <Button
                            variant="secondary"
                            onClick={() => setPlanStatus(p.id, "cancelled")}
                            className="h-8 px-3 text-xs"
                          >
                            Cancel
                          </Button>
                        )}
                        {p.status !== "pending" && (
                          <Button
                            variant="secondary"
                            onClick={() => setPlanStatus(p.id, "pending")}
                            className="h-8 px-3 text-xs"
                          >
                            Reopen
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          onClick={() => remove(p.id)}
                          className="h-8 px-3 text-xs"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {plans.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-sm text-zinc-500">
                      No plans in this date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
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
                  <Row label="Salesman" value={data.plan.user.name + (data.plan.user.employeeId ? ` (${data.plan.user.employeeId})` : "")} />
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
                        {o.reviewedBy && <div className="text-xs text-zinc-400">Reviewed by {o.reviewedBy.name}</div>}
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
