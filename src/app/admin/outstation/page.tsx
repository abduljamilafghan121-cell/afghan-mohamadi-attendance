"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "../../../components/AppShell";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { apiFetch } from "../../../lib/clientApi";
import { getToken, parseJwt } from "../../../lib/clientAuth";

type SUser = { id: string; name: string; email: string; isActive: boolean };
type Row = {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
  createdBy: { id: string; name: string } | null;
};

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmt(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString();
}

function dayCount(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export default function AdminOutstationPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const me = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [rows, setRows] = useState<Row[]>([]);
  const [users, setUsers] = useState<SUser[]>([]);
  const [filterUser, setFilterUser] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const today = ymd(new Date());
  const [form, setForm] = useState<{
    userId: string;
    startDate: string;
    endDate: string;
    reason: string;
  }>({ userId: "", startDate: today, endDate: today, reason: "" });

  useEffect(() => {
    if (!token) router.push("/login");
    else if (me && me.role !== "admin") router.push("/employee");
  }, [token, me, router]);

  const load = async () => {
    try {
      const qs = filterUser ? `?userId=${encodeURIComponent(filterUser)}` : "";
      const [r, u] = await Promise.all([
        apiFetch<{ rows: Row[] }>(`/api/admin/outstation${qs}`),
        apiFetch<{ users: SUser[] }>("/api/admin/users"),
      ]);
      setRows(r.rows);
      setUsers(u.users.filter((x) => x.isActive));
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    }
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filterUser]);

  const create = async () => {
    setError(null);
    if (!form.userId) return setError("Select a salesman");
    if (!form.startDate || !form.endDate) return setError("Pick dates");
    setBusy(true);
    try {
      await apiFetch("/api/admin/outstation", {
        method: "POST",
        body: JSON.stringify({
          userId: form.userId,
          startDate: form.startDate,
          endDate: form.endDate,
          reason: form.reason.trim() || null,
        }),
      });
      setForm({ userId: "", startDate: today, endDate: today, reason: "" });
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this outstation entry? Cancelled plans will not be restored.")) return;
    try {
      await apiFetch(`/api/admin/outstation?id=${id}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    }
  };

  const todayDate = new Date(today + "T00:00:00");
  const upcoming = rows.filter((r) => new Date(r.endDate) >= todayDate);
  const past = rows.filter((r) => new Date(r.endDate) < todayDate);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-zinc-900">Outstation Days</h1>
          <Link href="/admin/attendance" className="text-sm text-zinc-600 hover:underline">
            ← Attendance
          </Link>
        </div>

        <Card>
          <p className="text-sm text-zinc-600">
            Mark days when an employee is travelling. On those days they will not be counted as
            <span className="font-medium"> absent</span> in attendance, and any pending visit plans
            in the range will be auto-cancelled instead of being flagged as
            <span className="font-medium"> missed</span>.
          </p>
        </Card>

        <Card title="Add outstation entry">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs font-medium text-zinc-700">Employee</label>
              <select
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm focus:ring-4 focus:ring-zinc-100"
              >
                <option value="">Select…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Start date</label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">End date</label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={create} disabled={busy} className="w-full">
                Add
              </Button>
            </div>
            <div className="lg:col-span-5">
              <label className="mb-1 block text-xs font-medium text-zinc-700">Reason / Notes (optional)</label>
              <Input
                placeholder="e.g. Visiting clients in Erbil"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>
          </div>
          {error && <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </Card>

        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-medium text-zinc-700">Filter by employee:</label>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm"
            >
              <option value="">All employees</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </Card>

        <Card title={`Current & upcoming (${upcoming.length})`}>
          <OutstationTable rows={upcoming} onDelete={remove} highlight />
        </Card>

        <Card title={`Past (${past.length})`}>
          <OutstationTable rows={past} onDelete={remove} />
        </Card>
      </div>
    </AppShell>
  );
}

function OutstationTable({
  rows,
  onDelete,
  highlight,
}: {
  rows: Row[];
  onDelete: (id: string) => void;
  highlight?: boolean;
}) {
  if (rows.length === 0) {
    return <div className="py-4 text-center text-sm text-zinc-500">No entries.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-zinc-500">
            <th className="py-2 pr-3">Employee</th>
            <th className="py-2 pr-3">From</th>
            <th className="py-2 pr-3">To</th>
            <th className="py-2 pr-3">Days</th>
            <th className="py-2 pr-3">Reason</th>
            <th className="py-2 pr-3">Added by</th>
            <th className="py-2 pr-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((r) => (
            <tr key={r.id} className={highlight ? "bg-sky-50/30" : ""}>
              <td className="py-2 pr-3 font-medium text-zinc-800">{r.user.name}</td>
              <td className="py-2 pr-3 whitespace-nowrap">{fmt(r.startDate)}</td>
              <td className="py-2 pr-3 whitespace-nowrap">{fmt(r.endDate)}</td>
              <td className="py-2 pr-3">{dayCount(r.startDate, r.endDate)}</td>
              <td className="py-2 pr-3 text-zinc-600">{r.reason || "—"}</td>
              <td className="py-2 pr-3 text-zinc-500">{r.createdBy?.name || "—"}</td>
              <td className="py-2 pr-3 text-right">
                <Button
                  variant="secondary"
                  onClick={() => onDelete(r.id)}
                  className="h-8 px-3 text-xs"
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
