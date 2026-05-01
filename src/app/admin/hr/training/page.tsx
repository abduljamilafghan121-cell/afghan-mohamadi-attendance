"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../../components/AppShell";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { apiFetch } from "../../../../lib/clientApi";
import { getToken, parseJwt } from "../../../../lib/clientAuth";

type TrainingRecord = {
  id: string; userId: string; title: string; provider: string | null;
  startDate: string; endDate: string | null; status: string;
  certificate: string | null; notes: string | null; createdAt: string;
  user: { id: string; name: string; department: string | null };
};
type UserOption = { id: string; name: string; email: string | null; department: string | null };

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled",
};
const STATUS_COLORS: Record<string, string> = {
  planned: "bg-blue-50 text-blue-700",
  in_progress: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-zinc-100 text-zinc-500",
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
  userId: "", title: "", provider: "", startDate: "", endDate: "",
  status: "planned", certificate: "", notes: "",
};

export default function TrainingPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const jwtUser = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [filterUser, setFilterUser] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TrainingRecord | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TrainingRecord | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
    if (jwtUser && jwtUser.role !== "admin") router.push("/employee");
  }, [token, jwtUser, router]);

  const load = async () => {
    setLoading(true);
    try {
      const qs = filterUser ? `?userId=${filterUser}` : "";
      const res = await apiFetch<{ records: TrainingRecord[]; users: UserOption[] }>(`/api/admin/hr/training${qs}`);
      setRecords(res.records);
      setUsers(res.users);
    } catch (e: any) { setError(e?.message ?? "Failed"); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (token) load(); }, [token, filterUser]);

  const filtered = useMemo(() => {
    let result = records;
    if (filterStatus) result = result.filter((r) => r.status === filterStatus);
    const q = search.trim().toLowerCase();
    if (q) result = result.filter((r) =>
      r.title.toLowerCase().includes(q) ||
      r.user.name.toLowerCase().includes(q) ||
      (r.provider ?? "").toLowerCase().includes(q)
    );
    return result;
  }, [records, filterStatus, search]);

  const stats = useMemo(() => ({
    total: records.length,
    completed: records.filter((r) => r.status === "completed").length,
    inProgress: records.filter((r) => r.status === "in_progress").length,
    planned: records.filter((r) => r.status === "planned").length,
  }), [records]);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...emptyForm, startDate: new Date().toISOString().slice(0, 10) });
    setModalOpen(true); setError(null);
  };

  const openEdit = (r: TrainingRecord) => {
    setEditTarget(r);
    setForm({
      userId: r.userId, title: r.title, provider: r.provider ?? "",
      startDate: r.startDate?.slice(0, 10) ?? "",
      endDate: r.endDate?.slice(0, 10) ?? "",
      status: r.status, certificate: r.certificate ?? "", notes: r.notes ?? "",
    });
    setModalOpen(true); setError(null);
  };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const body = {
        ...form,
        provider: form.provider || null, endDate: form.endDate || null,
        certificate: form.certificate || null, notes: form.notes || null,
      };
      if (editTarget) {
        await apiFetch("/api/admin/hr/training", { method: "PATCH", body: JSON.stringify({ id: editTarget.id, ...body }) });
        setSuccess("Training record updated.");
      } else {
        await apiFetch("/api/admin/hr/training", { method: "POST", body: JSON.stringify(body) });
        setSuccess("Training record created.");
      }
      setModalOpen(false); await load();
    } catch (e: any) { setError(e?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/admin/hr/training?id=${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null); setSuccess("Record deleted."); await load();
    } catch (e: any) { setError(e?.message ?? "Failed"); }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Training & Development</h1>
            <p className="text-sm text-zinc-500">Track employee training, courses, and certifications</p>
          </div>
          <Button onClick={openCreate}>+ Add Training</Button>
        </div>

        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {success && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total", value: stats.total, color: "bg-zinc-50 text-zinc-700" },
            { label: "Completed", value: stats.completed, color: "bg-emerald-50 text-emerald-700" },
            { label: "In Progress", value: stats.inProgress, color: "bg-amber-50 text-amber-700" },
            { label: "Planned", value: stats.planned, color: "bg-blue-50 text-blue-700" },
          ].map((c) => (
            <div key={c.label} className={`rounded-2xl border p-4 ${c.color}`}>
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="mt-1 text-xs opacity-70">{c.label}</div>
            </div>
          ))}
        </div>

        <Card>
          <div className="mb-4 flex flex-wrap gap-3">
            <Input className="max-w-xs" placeholder="Search title, name, provider..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm">
              <option value="">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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
                  <th className="px-4 py-3">Training</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Provider</th>
                  <th className="px-4 py-3 hidden md:table-cell">Start Date</th>
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
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-800">{r.title}</div>
                      {r.certificate && <div className="text-xs text-emerald-600">🎓 Certified</div>}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">{r.provider ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-600 hidden md:table-cell">{r.startDate?.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-lg px-2 py-1 text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-zinc-100 text-zinc-600"}`}>
                        {STATUS_LABELS[r.status] ?? r.status}
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
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400">{loading ? "Loading..." : "No training records found."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {modalOpen && (
        <Modal title={editTarget ? "Edit Training Record" : "Add Training Record"} onClose={() => setModalOpen(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Employee *</label>
              <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm">
                <option value="">— Select employee —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Training Title *</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. First Aid Certification" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Provider / Institution</label>
              <Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="Optional" />
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
              <label className="mb-1 block text-xs font-medium">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm">
                {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Certificate / Credential</label>
              <Input value={form.certificate} onChange={(e) => setForm({ ...form, certificate: e.target.value })} placeholder="Certificate name or number" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm" />
            </div>
            {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving || !form.userId || !form.title || !form.startDate} className="flex-1">
                {saving ? "Saving..." : editTarget ? "Save Changes" : "Add Record"}
              </Button>
              <Button variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete Training Record" onClose={() => setDeleteTarget(null)}>
          <p className="mb-4 text-sm text-zinc-700">Delete <strong>{deleteTarget.title}</strong> for {deleteTarget.user.name}?</p>
          <div className="flex gap-2">
            <Button variant="danger" onClick={confirmDelete} className="flex-1">Delete</Button>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">Cancel</Button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
