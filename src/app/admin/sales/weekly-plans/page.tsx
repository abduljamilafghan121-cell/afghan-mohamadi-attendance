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

type SUser = { id: string; name: string };
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
  regionId: string | null;
  notes: string | null;
  isActive: boolean;
  user: { id: string; name: string };
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
    for (const t of templates) m.set(`${t.userId}_${t.weekday}`, t);
    return m;
  }, [templates]);

  const openEditor = (userId: string, weekday: number) => {
    const existing = cellMap.get(`${userId}_${weekday}`);
    setEditor({
      userId,
      weekday,
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
    const existing = cellMap.get(`${editor.userId}_${editor.weekday}`);
    if (!existing) {
      setEditor(null);
      return;
    }
    if (!confirm("Delete this weekday template? Future plans will no longer auto-generate.")) return;
    try {
      await apiFetch(`/api/admin/sales/weekly-plans?id=${existing.id}`, { method: "DELETE" });
      setEditor(null);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    }
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Weekly Visit Plans</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Set each salesman's weekly route once. The system creates each day's plan
              automatically.
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
                  {WEEKDAYS.map((w, i) => (
                    <th key={i} className="px-2 py-2 text-center">
                      {w}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="sticky left-0 z-10 bg-white py-2 pr-3 font-medium text-zinc-900">
                      {u.name}
                    </td>
                    {WEEKDAYS.map((_, w) => {
                      const t = cellMap.get(`${u.id}_${w}`);
                      const has = !!t && t.customers.length > 0;
                      return (
                        <td key={w} className="px-1 py-1 align-top">
                          <button
                            onClick={() => openEditor(u.id, w)}
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
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-sm text-zinc-500">
                      No users yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {editor && (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-zinc-900">
                  {users.find((u) => u.id === editor.userId)?.name} — {WEEKDAYS_FULL[editor.weekday]}
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
                    {cellMap.get(`${editor.userId}_${editor.weekday}`) && (
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
