"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/AppShell";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { apiFetch } from "../../../lib/clientApi";
import { getToken, parseJwt } from "../../../lib/clientAuth";

type Holiday = { id: string; date: string; name: string; createdAt: string };

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function currentYear() {
  return new Date().getFullYear();
}

function daysBetween(start: string, end: string) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!start || !end || e < s) return 0;
  return Math.round((e - s) / 86_400_000) + 1;
}

export default function AdminHolidaysPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [year, setYear] = useState(String(currentYear()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newStartDate, setNewStartDate] = useState(toDateStr(new Date()));
  const [newEndDate, setNewEndDate] = useState(toDateStr(new Date()));
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
    if (user && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ holidays: Holiday[] }>(`/api/admin/holidays?year=${year}`);
      setHolidays(res.holidays);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
  }, [token, year]);

  const addHoliday = async () => {
    if (!newName.trim() || !newStartDate) return;
    setAdding(true);
    setAddError(null);
    setAddSuccess(null);
    try {
      const res = await apiFetch<{ created: number; skipped: string[] }>("/api/admin/holidays", {
        method: "POST",
        body: JSON.stringify({
          startDate: newStartDate,
          endDate: newEndDate && newEndDate >= newStartDate ? newEndDate : newStartDate,
          name: newName.trim(),
        }),
      });
      const skippedMsg = res.skipped?.length
        ? ` (${res.skipped.length} day${res.skipped.length > 1 ? "s" : ""} already existed)`
        : "";
      setAddSuccess(`Added ${res.created} holiday day${res.created !== 1 ? "s" : ""}${skippedMsg}`);
      setNewName("");
      setNewStartDate(toDateStr(new Date()));
      setNewEndDate(toDateStr(new Date()));
      await load();
    } catch (e: any) {
      setAddError(e?.message ?? "Failed to add");
    } finally {
      setAdding(false);
    }
  };

  const deleteHoliday = async (id: string) => {
    if (!confirm("Delete this holiday?")) return;
    try {
      await apiFetch(`/api/admin/holidays/${id}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Failed to delete");
    }
  };

  const startEdit = (h: Holiday) => {
    setEditId(h.id);
    setEditName(h.name);
    setEditDate(h.date.slice(0, 10));
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editId) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await apiFetch(`/api/admin/holidays/${editId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName, date: editDate }),
      });
      setEditId(null);
      await load();
    } catch (e: any) {
      setEditError(e?.message ?? "Failed to save");
    } finally {
      setEditSaving(false);
    }
  };

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const byMonth = holidays.reduce<Record<number, Holiday[]>>((acc, h) => {
    const m = new Date(h.date).getUTCMonth();
    if (!acc[m]) acc[m] = [];
    acc[m].push(h);
    return acc;
  }, {});

  const rangeSize = daysBetween(newStartDate, newEndDate);
  const isRange = rangeSize > 1;

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Holidays</h1>
          <p className="text-sm text-zinc-500">Manage company-wide public holidays</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-zinc-600">Year</label>
          <Input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-24"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title={`Holidays in ${year} (${holidays.length})`}>
            {loading ? (
              <p className="text-sm text-zinc-400">Loading…</p>
            ) : error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : holidays.length === 0 ? (
              <p className="text-sm text-zinc-400">No holidays defined for {year}. Add one using the form.</p>
            ) : (
              <div className="space-y-6">
                {Object.entries(byMonth)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([month, list]) => (
                    <div key={month}>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                        {MONTHS[Number(month)]} — {list.length} day{list.length !== 1 ? "s" : ""}
                      </h3>
                      <div className="space-y-2">
                        {list.map((h) => (
                          <div key={h.id} className="rounded-xl border border-zinc-100 bg-white px-4 py-3">
                            {editId === h.id ? (
                              <div className="space-y-2">
                                <div className="flex gap-2">
                                  <Input
                                    type="date"
                                    value={editDate}
                                    onChange={(e) => setEditDate(e.target.value)}
                                    className="w-36"
                                  />
                                  <Input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="flex-1"
                                    placeholder="Holiday name"
                                  />
                                </div>
                                {editError && <p className="text-xs text-red-600">{editError}</p>}
                                <div className="flex gap-2">
                                  <Button onClick={saveEdit} disabled={editSaving || !editName.trim()}>
                                    {editSaving ? "Saving…" : "Save"}
                                  </Button>
                                  <Button variant="secondary" onClick={() => setEditId(null)}>Cancel</Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <span className="flex h-9 w-9 flex-col items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                                    <span className="text-xs font-bold leading-none">
                                      {new Date(h.date).getUTCDate()}
                                    </span>
                                    <span className="text-[10px] leading-none">
                                      {MONTHS[new Date(h.date).getUTCMonth()]}
                                    </span>
                                  </span>
                                  <div>
                                    <p className="font-medium text-zinc-900">{h.name}</p>
                                    <p className="text-xs text-zinc-400">{h.date.slice(0, 10)}</p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button variant="secondary" onClick={() => startEdit(h)}>Edit</Button>
                                  <Button variant="secondary" onClick={() => deleteHoliday(h.id)} className="text-red-600 hover:bg-red-50">Delete</Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card title="Add Holiday">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Holiday Name</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Eid Al-Fitr"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Start Date</label>
                <Input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => {
                    setNewStartDate(e.target.value);
                    if (e.target.value > newEndDate) setNewEndDate(e.target.value);
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  End Date{" "}
                  <span className="font-normal text-zinc-400">(same as start for 1 day)</span>
                </label>
                <Input
                  type="date"
                  value={newEndDate}
                  min={newStartDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                />
              </div>

              {isRange && (
                <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  This will add <strong>{rangeSize} holiday days</strong> with the same name.
                </div>
              )}

              {addError && <p className="text-sm text-red-600">{addError}</p>}
              {addSuccess && <p className="text-sm text-emerald-600">{addSuccess}</p>}
              <Button
                onClick={addHoliday}
                disabled={adding || !newName.trim() || !newStartDate}
                className="w-full"
              >
                {adding
                  ? "Adding…"
                  : isRange
                  ? `Add ${rangeSize} Holiday Days`
                  : "Add Holiday"}
              </Button>
            </div>
          </Card>

          <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-medium mb-1">How holidays work</p>
            <ul className="space-y-1 text-xs text-amber-700 list-disc list-inside">
              <li>Holidays apply company-wide to all employees</li>
              <li>Use a date range for multi-day holidays (e.g. Eid break)</li>
              <li>Each day in the range is stored separately so they can be edited individually</li>
              <li>Admins can override specific days for individual employees as overtime</li>
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
