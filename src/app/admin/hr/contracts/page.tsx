"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../../components/AppShell";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { apiFetch } from "../../../../lib/clientApi";
import { getToken, parseJwt } from "../../../../lib/clientAuth";

type Contract = {
  id: string; userId: string; contractType: string; startDate: string;
  endDate: string | null; probationEndDate: string | null; jobTitle: string | null;
  department: string | null; salary: number | null; currency: string;
  payFrequency: string; notes: string | null; isActive: boolean; createdAt: string;
  user: { id: string; name: string; email: string | null; department: string | null };
};
type UserOption = { id: string; name: string; email: string | null; department: string | null };

const CONTRACT_LABELS: Record<string, string> = {
  full_time: "Full-Time", part_time: "Part-Time", contract: "Contract", intern: "Intern",
};
const CONTRACT_COLORS: Record<string, string> = {
  full_time: "bg-emerald-50 text-emerald-700",
  part_time: "bg-blue-50 text-blue-700",
  contract: "bg-amber-50 text-amber-700",
  intern: "bg-purple-50 text-purple-700",
};

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

const emptyForm = {
  userId: "", contractType: "full_time", startDate: "", endDate: "", probationEndDate: "",
  jobTitle: "", department: "", salary: "", currency: "AFN", payFrequency: "monthly",
  notes: "", isActive: true,
};

export default function ContractsPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [filterUser, setFilterUser] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Contract | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
    if (user && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  const load = async () => {
    setLoading(true);
    try {
      const qs = filterUser ? `?userId=${filterUser}` : "";
      const res = await apiFetch<{ contracts: Contract[] }>(`/api/admin/hr/contracts${qs}`);
      setContracts(res.contracts);
    } catch (e: any) { setError(e?.message ?? "Failed"); }
    finally { setLoading(false); }
  };

  const loadUsers = async () => {
    const res = await apiFetch<{ users: UserOption[] }>("/api/admin/users?pageSize=500");
    setUsers(res.users);
  };

  useEffect(() => { if (token) { load(); loadUsers(); } }, [token, filterUser]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contracts;
    return contracts.filter((c) =>
      c.user.name.toLowerCase().includes(q) ||
      (c.department ?? "").toLowerCase().includes(q) ||
      (c.jobTitle ?? "").toLowerCase().includes(q)
    );
  }, [contracts, search]);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (c: Contract) => {
    setEditTarget(c);
    setForm({
      userId: c.userId,
      contractType: c.contractType,
      startDate: c.startDate?.slice(0, 10) ?? "",
      endDate: c.endDate?.slice(0, 10) ?? "",
      probationEndDate: c.probationEndDate?.slice(0, 10) ?? "",
      jobTitle: c.jobTitle ?? "",
      department: c.department ?? "",
      salary: c.salary != null ? String(c.salary) : "",
      currency: c.currency,
      payFrequency: c.payFrequency,
      notes: c.notes ?? "",
      isActive: c.isActive,
    });
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        ...form,
        salary: form.salary ? parseFloat(form.salary) : null,
        endDate: form.endDate || null,
        probationEndDate: form.probationEndDate || null,
        jobTitle: form.jobTitle || null,
        department: form.department || null,
        notes: form.notes || null,
      };
      if (editTarget) {
        await apiFetch("/api/admin/hr/contracts", { method: "PATCH", body: JSON.stringify({ id: editTarget.id, ...body }) });
        setSuccess("Contract updated.");
      } else {
        await apiFetch("/api/admin/hr/contracts", { method: "POST", body: JSON.stringify(body) });
        setSuccess("Contract created.");
      }
      setModalOpen(false);
      await load();
    } catch (e: any) { setError(e?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/admin/hr/contracts?id=${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      setSuccess("Contract deleted.");
      await load();
    } catch (e: any) { setError(e?.message ?? "Failed"); }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Employee Contracts</h1>
            <p className="text-sm text-zinc-500">Manage contracts, salary terms, and probation periods</p>
          </div>
          <Button onClick={openCreate}>+ New Contract</Button>
        </div>

        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {success && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

        <Card>
          <div className="mb-4 flex flex-wrap gap-3">
            <Input className="max-w-xs" placeholder="Search name, dept, title..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Start Date</th>
                  <th className="px-4 py-3 hidden md:table-cell">End Date</th>
                  <th className="px-4 py-3 hidden md:table-cell">Salary</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900">{c.user.name}</div>
                      <div className="text-xs text-zinc-400">{c.department ?? c.user.department ?? ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-lg px-2 py-1 text-xs font-medium ${CONTRACT_COLORS[c.contractType] ?? "bg-zinc-100 text-zinc-600"}`}>
                        {CONTRACT_LABELS[c.contractType] ?? c.contractType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">{c.startDate?.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-zinc-600 hidden md:table-cell">{c.endDate?.slice(0, 10) ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-600 hidden md:table-cell">
                      {c.salary != null ? `${c.currency} ${c.salary.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-lg px-2 py-1 text-xs font-medium ${c.isActive ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                        {c.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(c)} className="rounded-lg px-3 py-1.5 text-xs border border-zinc-200 hover:bg-zinc-100">Edit</button>
                        <button onClick={() => setDeleteTarget(c)} className="rounded-lg px-3 py-1.5 text-xs border border-red-200 text-red-600 hover:bg-red-50">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-400">{loading ? "Loading..." : "No contracts found."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {modalOpen && (
        <Modal title={editTarget ? "Edit Contract" : "New Contract"} onClose={() => setModalOpen(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Employee *</label>
              <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm" disabled={!!editTarget}>
                <option value="">— Select employee —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Contract Type</label>
                <select value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value })} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm">
                  <option value="full_time">Full-Time</option>
                  <option value="part_time">Part-Time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Status</label>
                <select value={form.isActive ? "active" : "inactive"} onChange={(e) => setForm({ ...form, isActive: e.target.value === "active" })} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Start Date *</label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">End Date</label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Probation End Date</label>
              <Input type="date" value={form.probationEndDate} onChange={(e) => setForm({ ...form, probationEndDate: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Job Title</label>
                <Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder="Optional" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Department</label>
                <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Optional" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium">Salary</label>
                <Input type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} placeholder="0" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Currency</label>
                <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder="AFN" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Pay Frequency</label>
              <select value={form.payFrequency} onChange={(e) => setForm({ ...form, payFrequency: e.target.value })} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm">
                <option value="monthly">Monthly</option>
                <option value="biweekly">Bi-Weekly</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm" placeholder="Optional notes..." />
            </div>
            {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving || !form.userId || !form.startDate} className="flex-1">
                {saving ? "Saving..." : editTarget ? "Save Changes" : "Create Contract"}
              </Button>
              <Button variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete Contract" onClose={() => setDeleteTarget(null)}>
          <p className="mb-4 text-sm text-zinc-700">Delete the contract for <strong>{deleteTarget.user.name}</strong>? This cannot be undone.</p>
          <div className="flex gap-2">
            <Button variant="danger" onClick={confirmDelete} className="flex-1">Delete</Button>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">Cancel</Button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
