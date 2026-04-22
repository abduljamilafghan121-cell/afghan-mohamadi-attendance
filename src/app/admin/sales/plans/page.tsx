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

  // One-off creation form
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
    </AppShell>
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
