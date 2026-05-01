"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../../components/AppShell";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { apiFetch } from "../../../../lib/clientApi";
import { getToken, parseJwt } from "../../../../lib/clientAuth";

type DisciplinaryRecord = {
  id: string; userId: string; type: string; date: string;
  reason: string; description: string | null; actionTaken: string | null;
  issuedById: string | null; createdAt: string;
  user: { id: string; name: string; department: string | null };
  issuedBy: { id: string; name: string } | null;
};
type UserOption = { id: string; name: string; email: string | null; department: string | null };

const TYPE_LABELS: Record<string, string> = {
  verbal_warning: "Verbal Warning",
  written_warning: "Written Warning",
  final_warning: "Final Warning",
  suspension: "Suspension",
  termination: "Termination",
};
const TYPE_COLORS: Record<string, string> = {
  verbal_warning: "bg-yellow-50 text-yellow-700",
  written_warning: "bg-orange-50 text-orange-700",
  final_warning: "bg-red-50 text-red-700",
  suspension: "bg-red-100 text-red-800",
  termination: "bg-zinc-800 text-white",
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
  userId: "", type: "verbal_warning", date: "", reason: "",
  description: "", actionTaken: "", issuedById: "",
};

export default function DisciplinaryPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const jwtUser = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [records, setRecords] = useState<DisciplinaryRecord[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [filterUser, setFilterUser] = useState("");
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DisciplinaryRecord | null>(null);
  const [viewTarget, setViewTarget] = useState<DisciplinaryRecord | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DisciplinaryRecord | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
    if (jwtUser && jwtUser.role !== "admin") router.push("/employee");
  }, [token, jwtUser, router]);

  const load = async () => {
    setLoading(true);
    try {
      const qs = filterUser ? `?userId=${filterUser}` : "";
      const res = await apiFetch<{ records: DisciplinaryRecord[]; users: UserOption[] }>(`/api/admin/hr/disciplinary${qs}`);
      setRecords(res.records);
      setUsers(res.users);
    } catch (e: any) { setError(e?.message ?? "Failed"); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (token) load(); }, [token, filterUser]);

  const filtered = useMemo(() => {
    let result = records;
    if (filterType) result = result.filter((r) => r.type === filterType);
    const q = search.trim().toLowerCase();
    if (q) result = result.filter((r) =>
      r.user.name.toLowerCase().includes(q) ||
      r.reason.toLowerCase().includes(q) ||
      (r.user.department ?? "").toLowerCase().includes(q)
    );
    return result;
  }, [records, filterType, search]);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10), issuedById: jwtUser?.id ?? "" });
    setModalOpen(true); setError(null);
  };

  const openEdit = (r: DisciplinaryRecord) => {
    setEditTarget(r);
    setForm({
      userId: r.userId, type: r.type,
      date: r.date?.slice(0, 10) ?? "",
      reason: r.reason, description: r.description ?? "",
      actionTaken: r.actionTaken ?? "", issuedById: r.issuedById ?? "",
    });
    setModalOpen(true); setError(null);
  };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const body = {
        ...form,
        description: form.description || null,
        actionTaken: form.actionTaken || null,
        issuedById: form.issuedById || null,
      };
      if (editTarget) {
        await apiFetch("/api/admin/hr/disciplinary", { method: "PATCH", body: JSON.stringify({ id: editTarget.id, ...body }) });
        setSuccess("Record updated.");
      } else {
        await apiFetch("/api/admin/hr/disciplinary", { method: "POST", body: JSON.stringify(body) });
        setSuccess("Record created.");
      }
      setModalOpen(false); await load();
    } catch (e: any) { setError(e?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/admin/hr/disciplinary?id=${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null); setSuccess("Record deleted."); await load();
    } catch (e: any) { setError(e?.message ?? "Failed"); }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Disciplinary Records</h1>
            <p className="text-sm text-zinc-500">Track warnings, suspensions, and disciplinary actions</p>
          </div>
          <Button onClick={openCreate}>+ Add Record</Button>
        </div>

        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {success && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

        <Card>
          <div className="mb-4 flex flex-wrap gap-3">
            <Input className="max-w-xs" placeholder="Search name, reason..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm">
              <option value="">All Types</option>
              {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Issued By</th>
                  <th className="px-4 py-3 hidden md:table-cell">Date</th>
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
                    <td className="px-4 py-3">
                      <span className={`rounded-lg px-2 py-1 text-xs font-medium ${TYPE_COLORS[r.type] ?? "bg-zinc-100 text-zinc-600"}`}>
                        {TYPE_LABELS[r.type] ?? r.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 max-w-xs truncate">{r.reason}</td>
                    <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">{r.issuedBy?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-600 hidden md:table-cell">{r.date?.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setViewTarget(r)} className="rounded-lg px-3 py-1.5 text-xs border border-zinc-200 hover:bg-zinc-100">View</button>
                        <button onClick={() => openEdit(r)} className="rounded-lg px-3 py-1.5 text-xs border border-blue-200 text-blue-600 hover:bg-blue-50">Edit</button>
                        <button onClick={() => setDeleteTarget(r)} className="rounded-lg px-3 py-1.5 text-xs border border-red-200 text-red-600 hover:bg-red-50">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400">{loading ? "Loading..." : "No records found."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {modalOpen && (
        <Modal title={editTarget ? "Edit Disciplinary Record" : "New Disciplinary Record"} onClose={() => setModalOpen(false)}>
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
                <label className="mb-1 block text-xs font-medium">Type *</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm">
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Date *</label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Reason *</label>
              <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Brief reason for action" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm" placeholder="Detailed description of the incident..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Action Taken</label>
              <textarea value={form.actionTaken} onChange={(e) => setForm({ ...form, actionTaken: e.target.value })} rows={2} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm" placeholder="What was done about it..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Issued By</label>
              <select value={form.issuedById} onChange={(e) => setForm({ ...form, issuedById: e.target.value })} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm">
                <option value="">— Select —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving || !form.userId || !form.reason || !form.date} className="flex-1">
                {saving ? "Saving..." : editTarget ? "Save Changes" : "Create Record"}
              </Button>
              <Button variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
            </div>
          </div>
        </Modal>
      )}

      {viewTarget && (
        <Modal title={`Disciplinary — ${viewTarget.user.name}`} onClose={() => setViewTarget(null)}>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Type</span>
              <span className={`rounded-lg px-2 py-1 text-xs font-medium ${TYPE_COLORS[viewTarget.type]}`}>{TYPE_LABELS[viewTarget.type]}</span>
            </div>
            <div className="flex items-center justify-between"><span className="text-zinc-500">Date</span><span>{viewTarget.date?.slice(0, 10)}</span></div>
            <div className="flex items-center justify-between"><span className="text-zinc-500">Issued By</span><span>{viewTarget.issuedBy?.name ?? "—"}</span></div>
            <div><div className="font-medium text-zinc-700 mb-1">Reason</div><p className="text-zinc-600 bg-zinc-50 rounded-lg p-3">{viewTarget.reason}</p></div>
            {viewTarget.description && <div><div className="font-medium text-zinc-700 mb-1">Description</div><p className="text-zinc-600 bg-zinc-50 rounded-lg p-3">{viewTarget.description}</p></div>}
            {viewTarget.actionTaken && <div><div className="font-medium text-zinc-700 mb-1">Action Taken</div><p className="text-zinc-600 bg-blue-50 rounded-lg p-3">{viewTarget.actionTaken}</p></div>}
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete Disciplinary Record" onClose={() => setDeleteTarget(null)}>
          <p className="mb-4 text-sm text-zinc-700">Delete this <strong>{TYPE_LABELS[deleteTarget.type]}</strong> for {deleteTarget.user.name}? This cannot be undone.</p>
          <div className="flex gap-2">
            <Button variant="danger" onClick={confirmDelete} className="flex-1">Delete</Button>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">Cancel</Button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
