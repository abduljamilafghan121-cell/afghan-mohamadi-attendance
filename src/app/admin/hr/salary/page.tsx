"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../../components/AppShell";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { apiFetch } from "../../../../lib/clientApi";
import { getToken, parseJwt } from "../../../../lib/clientAuth";
import { downloadTextFile } from "../../../../lib/exportUtils";

type SalaryRecord = {
  id: string; userId: string; month: number; year: number;
  baseSalary: number; allowances: number; deductions: number;
  netSalary: number; currency: string; payFrequency: string;
  notes: string | null; paidAt: string | null; createdAt: string;
  user: { id: string; name: string; email: string | null; department: string | null };
};
type UserOption = { id: string; name: string; email: string | null; department: string | null };

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-zinc-100 text-zinc-400">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function SalaryPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const jwtUser = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const now = new Date();
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterUser, setFilterUser] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SalaryRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SalaryRecord | null>(null);

  const emptyForm = { userId: "", month: now.getMonth() + 1, year: now.getFullYear(), baseSalary: "", allowances: "0", deductions: "0", currency: "AFN", payFrequency: "monthly", notes: "", paidAt: "" };
  const [form, setForm] = useState({ ...emptyForm });

  useEffect(() => {
    if (!token) router.push("/login");
    if (jwtUser && jwtUser.role !== "admin") router.push("/employee");
  }, [token, jwtUser, router]);

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ year: String(filterYear) });
      if (filterUser) qs.set("userId", filterUser);
      const res = await apiFetch<{ records: SalaryRecord[]; users: UserOption[] }>(`/api/admin/hr/salary?${qs}`);
      setRecords(res.records);
      setUsers(res.users);
    } catch (e: any) { setError(e?.message ?? "Failed"); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (token) load(); }, [token, filterYear, filterUser]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => r.user.name.toLowerCase().includes(q) || (r.user.department ?? "").toLowerCase().includes(q));
  }, [records, search]);

  const totals = useMemo(() => ({
    base: filtered.reduce((s, r) => s + r.baseSalary, 0),
    allowances: filtered.reduce((s, r) => s + r.allowances, 0),
    deductions: filtered.reduce((s, r) => s + r.deductions, 0),
    net: filtered.reduce((s, r) => s + r.netSalary, 0),
    paid: filtered.filter((r) => r.paidAt).length,
    unpaid: filtered.filter((r) => !r.paidAt).length,
  }), [filtered]);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
    setError(null);
  };

  const openEdit = (r: SalaryRecord) => {
    setEditTarget(r);
    setForm({
      userId: r.userId, month: r.month, year: r.year,
      baseSalary: String(r.baseSalary), allowances: String(r.allowances),
      deductions: String(r.deductions), currency: r.currency,
      payFrequency: r.payFrequency, notes: r.notes ?? "",
      paidAt: r.paidAt ? r.paidAt.slice(0, 10) : "",
    });
    setModalOpen(true);
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        userId: form.userId, month: Number(form.month), year: Number(form.year),
        baseSalary: parseFloat(form.baseSalary) || 0,
        allowances: parseFloat(form.allowances) || 0,
        deductions: parseFloat(form.deductions) || 0,
        currency: form.currency, payFrequency: form.payFrequency,
        notes: form.notes || null, paidAt: form.paidAt || null,
      };
      await apiFetch("/api/admin/hr/salary", { method: "POST", body: JSON.stringify(body) });
      setSuccess("Salary record saved.");
      setModalOpen(false);
      await load();
    } catch (e: any) { setError(e?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/admin/hr/salary?id=${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      setSuccess("Record deleted.");
      await load();
    } catch (e: any) { setError(e?.message ?? "Failed"); }
  };

  const exportCsv = () => {
    const header = "Employee,Department,Month,Year,Base Salary,Allowances,Deductions,Net Salary,Currency,Paid";
    const rows = filtered.map((r) =>
      `"${r.user.name}","${r.user.department ?? ""}",${MONTHS[r.month - 1]},${r.year},${r.baseSalary},${r.allowances},${r.deductions},${r.netSalary},${r.currency},${r.paidAt ? "Yes" : "No"}`
    );
    downloadTextFile(`salary_${filterYear}.csv`, [header, ...rows].join("\n"), "text/csv");
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Payroll & Salary</h1>
            <p className="text-sm text-zinc-500">Manage monthly salary records and payslips</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
            <Button onClick={openCreate}>+ Add Record</Button>
          </div>
        </div>

        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {success && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total Net Payroll", value: `AFN ${totals.net.toLocaleString()}`, color: "bg-blue-50 text-blue-700" },
            { label: "Total Base", value: `AFN ${totals.base.toLocaleString()}`, color: "bg-zinc-50 text-zinc-700" },
            { label: "Paid", value: totals.paid, color: "bg-emerald-50 text-emerald-700" },
            { label: "Pending Payment", value: totals.unpaid, color: "bg-amber-50 text-amber-700" },
          ].map((c) => (
            <div key={c.label} className={`rounded-2xl border p-4 ${c.color}`}>
              <div className="text-xl font-bold">{c.value}</div>
              <div className="mt-1 text-xs opacity-70">{c.label}</div>
            </div>
          ))}
        </div>

        <Card>
          <div className="mb-4 flex flex-wrap gap-3">
            <Input className="max-w-xs" placeholder="Search name or department..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm">
              <option value="">All Employees</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Base</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Allowances</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Deductions</th>
                  <th className="px-4 py-3">Net Salary</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900">{r.user.name}</div>
                      <div className="text-xs text-zinc-400">{r.user.department ?? ""}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{MONTHS[r.month - 1]} {r.year}</td>
                    <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">{r.currency} {r.baseSalary.toLocaleString()}</td>
                    <td className="px-4 py-3 text-emerald-600 hidden sm:table-cell">+{r.allowances.toLocaleString()}</td>
                    <td className="px-4 py-3 text-red-600 hidden sm:table-cell">-{r.deductions.toLocaleString()}</td>
                    <td className="px-4 py-3 font-semibold text-zinc-900">{r.currency} {r.netSalary.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-lg px-2 py-1 text-xs font-medium ${r.paidAt ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {r.paidAt ? `Paid ${r.paidAt.slice(0, 10)}` : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(r)} className="rounded-lg px-3 py-1.5 text-xs border border-zinc-200 hover:bg-zinc-100">Edit</button>
                        <button onClick={() => setDeleteTarget(r)} className="rounded-lg px-3 py-1.5 text-xs border border-red-200 text-red-600 hover:bg-red-50">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-400">{loading ? "Loading..." : "No salary records found."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {modalOpen && (
        <Modal title={editTarget ? "Edit Salary Record" : "Add Salary Record"} onClose={() => setModalOpen(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Employee *</label>
              <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm">
                <option value="">— Select employee —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Month</label>
                <select value={form.month} onChange={(e) => setForm({ ...form, month: Number(e.target.value) })} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm">
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Year</label>
                <select value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm">
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium">Base Salary *</label>
                <Input type="number" value={form.baseSalary} onChange={(e) => setForm({ ...form, baseSalary: e.target.value })} placeholder="0" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Currency</label>
                <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder="AFN" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Allowances</label>
                <Input type="number" value={form.allowances} onChange={(e) => setForm({ ...form, allowances: e.target.value })} placeholder="0" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Deductions</label>
                <Input type="number" value={form.deductions} onChange={(e) => setForm({ ...form, deductions: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3 text-sm">
              Net Salary = <strong className="text-emerald-700">
                {((parseFloat(form.baseSalary) || 0) + (parseFloat(form.allowances) || 0) - (parseFloat(form.deductions) || 0)).toLocaleString()} {form.currency}
              </strong>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Payment Date (leave blank if unpaid)</label>
              <Input type="date" value={form.paidAt} onChange={(e) => setForm({ ...form, paidAt: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm" />
            </div>
            {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving || !form.userId || !form.baseSalary} className="flex-1">
                {saving ? "Saving..." : "Save Record"}
              </Button>
              <Button variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete Salary Record" onClose={() => setDeleteTarget(null)}>
          <p className="mb-4 text-sm text-zinc-700">Delete {MONTHS[deleteTarget.month - 1]} {deleteTarget.year} record for <strong>{deleteTarget.user.name}</strong>?</p>
          <div className="flex gap-2">
            <Button variant="danger" onClick={confirmDelete} className="flex-1">Delete</Button>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">Cancel</Button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
