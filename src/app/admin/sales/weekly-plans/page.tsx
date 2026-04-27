"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "../../../../components/AppShell";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { apiFetch } from "../../../../lib/clientApi";
import { getToken, parseJwt } from "../../../../lib/clientAuth";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const CYCLE_OPTIONS = [
  { value: 1, label: "Weekly (1)" },
  { value: 2, label: "Bi-weekly (2)" },
  { value: 4, label: "Monthly (4)" },
];

type SUser = { id: string; name: string; planCycleWeeks: number };
type Region = { id: string; name: string };
type Shop = {
  id: string;
  name: string;
  regionId: string | null;
  region: { id: string; name: string } | null;
};
type Template = {
  id: string;
  userId: string;
  weekday: number;
  weekIndex: number;
  regionId: string | null;
  notes: string | null;
  isActive: boolean;
  user: { id: string; name: string; planCycleWeeks: number };
  region: { id: string; name: string } | null;
  customers: { shopId: string; shop: { id: string; name: string } }[];
};

export default function AdminWeeklyPlansPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [users, setUsers] = useState<SUser[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [allShops, setAllShops] = useState<Shop[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editor, setEditor] = useState<{
    userId: string;
    weekday: number;
    weekIndex: number;
    regionId: string | null;
    notes: string;
    shopIds: Set<string>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
    else if (user && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  const load = async () => {
    try {
      const [u, r, s, t] = await Promise.all([
        apiFetch<{ users: SUser[] }>("/api/admin/sales/users"),
        apiFetch<{ regions: Region[] }>("/api/sales/regions"),
        apiFetch<{ shops: Shop[] }>("/api/admin/sales/shops"),
        apiFetch<{ templates: Template[] }>("/api/admin/sales/weekly-plans"),
      ]);
      setUsers(u.users);
      setRegions(r.regions);
      setAllShops(s.shops);
      setTemplates(t.templates);
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    }
  };

  useEffect(() => {
    if (token) load();
  }, [token]);

  const cellMap = useMemo(() => {
    const m = new Map<string, Template>();
    for (const t of templates) m.set(`${t.userId}_${t.weekday}_${t.weekIndex}`, t);
    return m;
  }, [templates]);

  const openEditor = (userId: string, weekday: number, weekIndex: number) => {
    const existing = cellMap.get(`${userId}_${weekday}_${weekIndex}`);
    setEditor({
      userId,
      weekday,
      weekIndex,
      regionId: existing?.regionId ?? null,
      notes: existing?.notes ?? "",
      shopIds: new Set(existing?.customers.map((c) => c.shopId) ?? []),
    });
  };

  const filteredShops = useMemo(() => {
    if (!editor) return [];
    if (!editor.regionId) return allShops;
    return allShops.filter((s) => s.regionId === editor.regionId);
  }, [editor, allShops]);

  const save = async () => {
    if (!editor) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/admin/sales/weekly-plans", {
        method: "POST",
        body: JSON.stringify({
          userId: editor.userId,
          weekday: editor.weekday,
          weekIndex: editor.weekIndex,
          regionId: editor.regionId,
          notes: editor.notes || null,
          shopIds: Array.from(editor.shopIds),
        }),
      });
      setEditor(null);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editor) return;
    const existing = cellMap.get(`${editor.userId}_${editor.weekday}_${editor.weekIndex}`);
    if (!existing) {
      setEditor(null);
      return;
    }
    if (!confirm("Delete this template? Future plans will no longer auto-generate for this slot.")) return;
    try {
      await apiFetch(`/api/admin/sales/weekly-plans?id=${existing.id}`, { method: "DELETE" });
      setEditor(null);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    }
  };

  const changeCycle = async (u: SUser, newCycle: number) => {
    if (newCycle === u.planCycleWeeks) return;
    if (newCycle < u.planCycleWeeks) {
      const dropped = templates.filter(
        (t) => t.userId === u.id && t.weekIndex > newCycle,
      );
      if (dropped.length > 0) {
        const ok = confirm(
          `Switching ${u.name} to a ${newCycle}-week cycle will delete ${dropped.length} template${dropped.length === 1 ? "" : "s"} (Week ${newCycle + 1}–${u.planCycleWeeks}). Continue?`,
        );
        if (!ok) return;
      }
    }
    setError(null);
    try {
      await apiFetch("/api/admin/sales/users", {
        method: "PATCH",
        body: JSON.stringify({ id: u.id, planCycleWeeks: newCycle }),
      });
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to change cycle");
    }
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Weekly Visit Plans</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Set each salesman's route once. Pick a rotation cycle (Weekly /
              Bi-weekly / Monthly) when one week isn't enough to cover all
              their customers — the system picks the right week automatically.
            </p>
          </div>
          <div className="flex gap-2 text-sm">
            <Link href="/admin/sales/regions" className="text-zinc-600 hover:underline">
              Regions
            </Link>
            <Link href="/admin/sales/customers" className="text-zinc-600 hover:underline">
              Customer regions
            </Link>
            <Link href="/admin/sales/plans" className="text-zinc-600 hover:underline">
              Daily plans
            </Link>
          </div>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-zinc-500">
                  <th className="sticky left-0 z-10 bg-white py-2 pr-3">Salesman</th>
                  <th className="px-2 py-2">Cycle</th>
                  <th className="px-2 py-2">Week</th>
                  {WEEKDAYS.map((w, i) => (
                    <th key={i} className="px-2 py-2 text-center">
                      {w}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {users.map((u) => {
                  const cycle = u.planCycleWeeks || 1;
                  const weekRows = Array.from({ length: cycle }, (_, i) => i + 1);
                  return weekRows.map((wIdx) => (
                    <tr key={`${u.id}_${wIdx}`} className={wIdx === 1 ? "" : "bg-zinc-50/40"}>
                      {wIdx === 1 ? (
                        <>
                          <td
                            rowSpan={cycle}
                            className="sticky left-0 z-10 bg-white py-2 pr-3 align-top font-medium text-zinc-900"
                          >
                            {u.name}
                          </td>
                          <td rowSpan={cycle} className="px-2 py-2 align-top">
                            <select
                              value={cycle}
                              onChange={(e) => changeCycle(u, Number(e.target.value))}
                              className="h-8 rounded-lg border border-zinc-300 bg-white px-2 text-xs"
                            >
                              {CYCLE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        </>
                      ) : null}
                      <td className="px-2 py-1 text-xs font-semibold text-zinc-600">
                        {cycle === 1 ? "—" : `Wk ${wIdx}`}
                      </td>
                      {WEEKDAYS.map((_, w) => {
                        const t = cellMap.get(`${u.id}_${w}_${wIdx}`);
                        const has = !!t && t.customers.length > 0;
                        return (
                          <td key={w} className="px-1 py-1 align-top">
                            <button
                              onClick={() => openEditor(u.id, w, wIdx)}
                              className={`block w-full rounded-lg border p-2 text-left text-xs transition ${
                                has
                                  ? "border-blue-200 bg-blue-50 hover:bg-blue-100"
                                  : "border-dashed border-zinc-300 bg-white text-zinc-500 hover:bg-zinc-50"
                              }`}
                            >
                              {has ? (
                                <>
                                  <div className="font-semibold text-blue-900">
                                    {t!.region?.name ?? "Mixed"}
                                  </div>
                                  <div className="text-blue-700">
                                    {t!.customers.length} customer
                                    {t!.customers.length === 1 ? "" : "s"}
                                  </div>
                                </>
                              ) : (
                                <span>+ Add</span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ));
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-6 text-center text-sm text-zinc-500">
                      No users yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-xs text-zinc-500">
            Tip: With a Monthly (4-week) cycle, each weekday has four separate
            slots — Week 1 / Week 2 / Week 3 / Week 4 — so a salesman with many
            customers can rotate through them across the month.
          </div>
        </Card>

        {editor && (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-zinc-900">
                  {users.find((u) => u.id === editor.userId)?.name} —{" "}
                  {WEEKDAYS_FULL[editor.weekday]}
                  {(() => {
                    const u = users.find((x) => x.id === editor.userId);
                    const c = u?.planCycleWeeks || 1;
                    return c > 1 ? ` (Week ${editor.weekIndex} of ${c})` : "";
                  })()}
                </h2>
                <button
                  onClick={() => setEditor(null)}
                  className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Region</label>
                  <select
                    value={editor.regionId ?? ""}
                    onChange={(e) =>
                      setEditor({ ...editor, regionId: e.target.value || null })
                    }
                    className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm"
                  >
                    <option value="">— No region (all customers) —</option>
                    {regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Notes for salesman (optional)
                  </label>
                  <textarea
                    rows={2}
                    value={editor.notes}
                    onChange={(e) => setEditor({ ...editor, notes: e.target.value })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    placeholder="e.g. push new product X, collect overdue invoices"
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-sm font-medium text-zinc-700">
                      Customers ({editor.shopIds.size} selected)
                    </label>
                    <div className="flex gap-2 text-xs">
                      <button
                        onClick={() =>
                          setEditor({
                            ...editor,
                            shopIds: new Set(filteredShops.map((s) => s.id)),
                          })
                        }
                        className="text-blue-600 underline"
                      >
                        Select all in region
                      </button>
                      <button
                        onClick={() => setEditor({ ...editor, shopIds: new Set() })}
                        className="text-zinc-600 underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto rounded-xl border border-zinc-200">
                    {filteredShops.length === 0 ? (
                      <div className="p-4 text-sm text-zinc-500">
                        No customers in this region. Tag some in Customer Regions.
                      </div>
                    ) : (
                      filteredShops.map((s) => {
                        const checked = editor.shopIds.has(s.id);
                        return (
                          <label
                            key={s.id}
                            className="flex cursor-pointer items-center gap-3 border-b border-zinc-100 px-3 py-2 last:border-0 hover:bg-zinc-50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const newSet = new Set(editor.shopIds);
                                if (e.target.checked) newSet.add(s.id);
                                else newSet.delete(s.id);
                                setEditor({ ...editor, shopIds: newSet });
                              }}
                              className="h-4 w-4"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-zinc-900">{s.name}</div>
                              {s.region && (
                                <div className="text-xs text-zinc-500">{s.region.name}</div>
                              )}
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <div>
                    {cellMap.get(`${editor.userId}_${editor.weekday}_${editor.weekIndex}`) && (
                      <Button variant="danger" onClick={remove} className="h-9 text-sm">
                        Delete template
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setEditor(null)}
                      className="h-9 text-sm"
                    >
                      Cancel
                    </Button>
                    <Button onClick={save} disabled={busy} className="h-9 text-sm">
                      {busy ? "Saving…" : "Save template"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
