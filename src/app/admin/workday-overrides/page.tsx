"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/AppShell";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { apiFetch } from "../../../lib/clientApi";
import { getToken, parseJwt } from "../../../lib/clientAuth";

type Override = {
  id: string;
  userId: string;
  date: string;
  isOvertime: boolean;
  note: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string | null };
};

type UserOption = { id: string; name: string; email: string | null };
type HolidayOption = { id: string; date: string; name: string };

function toDateStr(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function WorkdayOverridesPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [overrides, setOverrides] = useState<Override[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [filterUserId, setFilterUserId] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newUserId, setNewUserId] = useState("");
  const [newDate, setNewDate] = useState(toDateStr(new Date()));
  const [newNote, setNewNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  const [holidays, setHolidays] = useState<HolidayOption[]>([]);

  useEffect(() => {
    if (!token) router.push("/login");
    if (user && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ month });
      if (filterUserId) qs.set("userId", filterUserId);
      const res = await apiFetch<{ overrides: Override[] }>(`/api/admin/workday-overrides?${qs}`);
      setOverrides(res.overrides);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    apiFetch<{ users: UserOption[] }>("/api/admin/users")
      .then((r) => {
        setUsers(r.users);
        if (r.users.length > 0) setNewUserId(r.users[0].id);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token || !month) return;
    const year = month.slice(0, 4);
    apiFetch<{ holidays: HolidayOption[] }>(`/api/admin/holidays?year=${year}`)
      .then((r) => setHolidays(r.holidays))
      .catch(() => setHolidays([]));
  }, [token, month]);

  const monthHolidays = holidays.filter((h) => h.date.slice(0, 7) === month);

  useEffect(() => {
    if (token) load();
  }, [token, month, filterUserId]);

  const addOverride = async () => {
    if (!newUserId || !newDate) return;
    setAdding(true);
    setAddError(null);
    setAddSuccess(null);
    try {
      await apiFetch("/api/admin/workday-overrides", {
        method: "POST",
        body: JSON.stringify({
          userId: newUserId,
          date: newDate,
          isOvertime: true,
          note: newNote.trim() || undefined,
        }),
      });
      setAddSuccess("Override added");
      setNewNote("");
      await load();
    } catch (e: any) {
      setAddError(e?.message ?? "Failed to add");
    } finally {
      setAdding(false);
    }
  };

  const removeOverride = async (id: string) => {
    if (!confirm("Remove this workday override?")) return;
    try {
      await apiFetch(`/api/admin/workday-overrides?id=${id}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Failed to remove");
    }
  };

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Workday Overrides</h1>
        <p className="text-sm text-zinc-500">
          Mark off-days or holidays as working days for specific employees — they will be tracked as overtime
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-zinc-600">Month</label>
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-36"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-zinc-600">Employee</label>
              <select
                value={filterUserId}
                onChange={(e) => setFilterUserId(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">All employees</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          <Card title="Overrides">
            {loading ? (
              <p className="text-sm text-zinc-400">Loading…</p>
            ) : error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : overrides.length === 0 ? (
              <p className="text-sm text-zinc-400">No overrides found for this period.</p>
            ) : (
              <div className="space-y-2">
                {overrides.map((o) => (
                  <div key={o.id} className="flex items-center justify-between rounded-xl border border-zinc-100 bg-white px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 flex-col items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                        <span className="text-xs font-bold leading-none">
                          {new Date(o.date).getUTCDate()}
                        </span>
                        <span className="text-[10px] leading-none">
                          {new Date(o.date).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900">{o.user.name}</p>
                        <p className="text-xs text-zinc-500">
                          {o.date.slice(0, 10)}
                          {o.note && <span className="ml-2 italic">"{o.note}"</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {o.isOvertime && (
                        <span className="rounded-lg bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                          Overtime
                        </span>
                      )}
                      <Button
                        variant="secondary"
                        onClick={() => removeOverride(o.id)}
                        className="text-red-600 hover:bg-red-50 text-xs px-2 py-1"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card title="Add Override">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Employee</label>
                <select
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              {monthHolidays.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Holidays this month — tap to select
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {monthHolidays.map((h) => {
                      const d = h.date.slice(0, 10);
                      const isSelected = newDate === d;
                      return (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => setNewDate(d)}
                          className={`rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${isSelected ? "bg-amber-600 text-white border-amber-600" : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"}`}
                        >
                          {new Date(h.date).getUTCDate()} – {h.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Date (off-day or holiday)</label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Note (optional)</label>
                <Input
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="e.g. Emergency coverage"
                />
              </div>
              {addError && <p className="text-sm text-red-600">{addError}</p>}
              {addSuccess && <p className="text-sm text-emerald-600">{addSuccess}</p>}
              <Button onClick={addOverride} disabled={adding || !newUserId || !newDate} className="w-full">
                {adding ? "Adding…" : "Add Override (Overtime)"}
              </Button>
            </div>
          </Card>

          <div className="mt-4 rounded-xl bg-violet-50 p-4 text-sm text-violet-800">
            <p className="font-medium mb-1">How overrides work</p>
            <ul className="space-y-1 text-xs text-violet-700 list-disc list-inside">
              <li>Select an employee and a normally off/holiday date</li>
              <li>The day becomes a working day for that employee</li>
              <li>Any attendance that day is marked as <strong>Overtime</strong></li>
              <li>It shows in attendance reports with an overtime badge</li>
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
