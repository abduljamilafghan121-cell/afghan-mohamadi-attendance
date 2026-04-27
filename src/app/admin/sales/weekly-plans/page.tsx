"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "../../../../components/AppShell";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { apiFetch } from "../../../../lib/clientApi";
import { getToken, parseJwt } from "../../../../lib/clientAuth";
import { exportHtmlReport } from "../../../../lib/exportUtils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Tiny HTML escape so customer names with special chars never break the PDF.
const escHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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
  const [orgName, setOrgName] = useState("");
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
      const [u, r, s, t, o] = await Promise.all([
        apiFetch<{ users: SUser[] }>("/api/admin/sales/users"),
        apiFetch<{ regions: Region[] }>("/api/sales/regions"),
        apiFetch<{ shops: Shop[] }>("/api/admin/sales/shops"),
        apiFetch<{ templates: Template[] }>("/api/admin/sales/weekly-plans"),
        apiFetch<{ org?: { title?: string } }>("/api/org").catch(() => ({ org: { title: "" } })),
      ]);
      setUsers(u.users);
      setRegions(r.regions);
      setAllShops(s.shops);
      setTemplates(t.templates);
      setOrgName(o.org?.title ?? "");
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

  // Build a printable HTML "Visit Plan" report for one salesman.
  // Layout: header (org + salesman + cycle), then one table per cycle week,
  // each table has a row per weekday showing the assigned region and the full
  // list of customers for that day. Empty days are shown as "— No visits —".
  const exportUserPlanPdf = async (u: SUser) => {
    try {
      const cycle = u.planCycleWeeks || 1;
      const userTpls = templates.filter((t) => t.userId === u.id);
      const totalCustomers = userTpls.reduce((s, t) => s + t.customers.length, 0);
      const activeDays = userTpls.filter((t) => t.customers.length > 0).length;

      const cycleLabel =
        cycle === 1 ? "Weekly" : cycle === 2 ? "Bi-weekly" : cycle === 4 ? "Monthly" : `${cycle}-week`;

      const weekSections = Array.from({ length: cycle }, (_, i) => i + 1)
        .map((wIdx) => {
          const dayRows = WEEKDAYS_FULL.map((dayName, w) => {
            const t = userTpls.find((x) => x.weekday === w && x.weekIndex === wIdx);
            const region = t?.region?.name ?? "—";
            const custs = t?.customers ?? [];
            const custList =
              custs.length === 0
                ? `<span class="empty">— No visits —</span>`
                : custs
                    .map((c) => `<span class="cust">${escHtml(c.shop.name)}</span>`)
                    .join(" ");
            const notes = t?.notes ? `<div class="notes">Note: ${escHtml(t.notes)}</div>` : "";
            return `
              <tr>
                <td class="day">${dayName}</td>
                <td class="region">${escHtml(region)}</td>
                <td class="count">${custs.length}</td>
                <td class="customers">${custList}${notes}</td>
              </tr>`;
          }).join("");

          const weekHeader =
            cycle === 1
              ? ""
              : `<h3 class="week-h">Week ${wIdx} of ${cycle}</h3>`;

          return `
            ${weekHeader}
            <table class="plan">
              <thead>
                <tr>
                  <th style="width:90px">Day</th>
                  <th style="width:140px">Region</th>
                  <th style="width:50px">#</th>
                  <th>Customers</th>
                </tr>
              </thead>
              <tbody>${dayRows}</tbody>
            </table>`;
        })
        .join("");

      const orgTitle = orgName || "Organization";
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Visit Plan - ${escHtml(u.name)} - ${escHtml(orgTitle)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 32px; font-size: 12px; }
    .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 20px; }
    .header h1 { font-size: 22px; font-weight: bold; letter-spacing: 1px; }
    .header h2 { font-size: 14px; color: #555; margin-top: 4px; font-weight: normal; }
    .header .filter { font-size: 11px; color: #777; margin-top: 6px; }
    .summary { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .summary-box { border: 1px solid #ddd; border-radius: 6px; padding: 10px 16px; min-width: 100px; text-align: center; }
    .summary-box .label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-box .value { font-size: 20px; font-weight: bold; margin-top: 2px; color: #2563eb; }
    .week-h { font-size: 13px; font-weight: bold; color: #1e40af; margin: 18px 0 6px; padding: 4px 8px; background: #eff6ff; border-left: 3px solid #2563eb; }
    table.plan { width: 100%; border-collapse: collapse; margin-top: 4px; page-break-inside: auto; }
    table.plan th { background: #f3f4f6; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; text-align: left; border-bottom: 2px solid #ddd; }
    table.plan td { padding: 8px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
    table.plan tr:nth-child(even) td { background: #fafafa; }
    table.plan tr { page-break-inside: avoid; }
    td.day { font-weight: bold; color: #111; white-space: nowrap; }
    td.region { color: #1e3a8a; font-weight: 600; }
    td.count { text-align: center; color: #555; font-weight: 600; }
    td.customers { line-height: 1.7; }
    .cust { display: inline-block; background: #eff6ff; color: #1e3a8a; padding: 2px 8px; border-radius: 4px; margin: 2px 3px 2px 0; font-size: 11px; }
    .empty { color: #aaa; font-style: italic; }
    .notes { margin-top: 4px; font-size: 10px; color: #92400e; background: #fef3c7; padding: 3px 6px; border-radius: 3px; display: inline-block; }
    .footer { margin-top: 24px; font-size: 10px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
    @media print {
      body { padding: 16px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escHtml(orgTitle)}</h1>
    <h2>Weekly Visit Plan — ${escHtml(u.name)}</h2>
    <div class="filter">Rotation cycle: ${cycleLabel} (${cycle} week${cycle === 1 ? "" : "s"})</div>
  </div>
  <div class="summary">
    <div class="summary-box"><div class="label">Cycle</div><div class="value">${cycleLabel}</div></div>
    <div class="summary-box"><div class="label">Active Days</div><div class="value">${activeDays}</div></div>
    <div class="summary-box"><div class="label">Total Customer Slots</div><div class="value">${totalCustomers}</div></div>
  </div>
  ${weekSections}
  <div class="footer">Generated on ${new Date().toLocaleString()} &nbsp;|&nbsp; ${escHtml(orgTitle)} Sales Module</div>
</body>
</html>`;

      const safeName = u.name.replace(/[^a-z0-9]+/gi, "_");
      await exportHtmlReport(`visit_plan_${safeName}`, html);
    } catch (e: any) {
      alert(e?.message ?? "Export failed");
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
              Customers
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
                            <div className="flex flex-col gap-1.5">
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
                              <button
                                type="button"
                                onClick={() => exportUserPlanPdf(u)}
                                className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
                                title="Export this salesman's full visit plan as PDF"
                              >
                                Export PDF
                              </button>
                            </div>
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
