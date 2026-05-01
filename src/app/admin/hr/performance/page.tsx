"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../../components/AppShell";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { apiFetch } from "../../../../lib/clientApi";
import { getToken, parseJwt } from "../../../../lib/clientAuth";

type Review = {
  id: string; userId: string; reviewerId: string; reviewPeriod: string;
  rating: string; goals: string | null; achievements: string | null;
  improvements: string | null; comments: string | null; reviewDate: string;
  user: { id: string; name: string; department: string | null };
  reviewer: { id: string; name: string };
};
type UserOption = { id: string; name: string; email: string | null; department: string | null };

const RATING_LABELS: Record<string, string> = {
  outstanding: "Outstanding",
  exceeds_expectations: "Exceeds Expectations",
  meets_expectations: "Meets Expectations",
  needs_improvement: "Needs Improvement",
  unsatisfactory: "Unsatisfactory",
};
const RATING_COLORS: Record<string, string> = {
  outstanding: "bg-emerald-50 text-emerald-700",
  exceeds_expectations: "bg-blue-50 text-blue-700",
  meets_expectations: "bg-zinc-100 text-zinc-600",
  needs_improvement: "bg-amber-50 text-amber-700",
  unsatisfactory: "bg-red-50 text-red-700",
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
  userId: "", reviewerId: "", reviewPeriod: "", rating: "meets_expectations",
  goals: "", achievements: "", improvements: "", comments: "", reviewDate: "",
};

export default function PerformancePage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const jwtUser = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [filterUser, setFilterUser] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Review | null>(null);
  const [viewTarget, setViewTarget] = useState<Review | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
    if (jwtUser && jwtUser.role !== "admin") router.push("/employee");
  }, [token, jwtUser, router]);

  const load = async () => {
    setLoading(true);
    try {
      const qs = filterUser ? `?userId=${filterUser}` : "";
      const res = await apiFetch<{ reviews: Review[]; users: UserOption[] }>(`/api/admin/hr/performance${qs}`);
      setReviews(res.reviews);
      setUsers(res.users);
    } catch (e: any) { setError(e?.message ?? "Failed"); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (token) load(); }, [token, filterUser]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter((r) =>
      r.user.name.toLowerCase().includes(q) ||
      r.reviewPeriod.toLowerCase().includes(q) ||
      (r.user.department ?? "").toLowerCase().includes(q)
    );
  }, [reviews, search]);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...emptyForm, reviewDate: new Date().toISOString().slice(0, 10) });
    setModalOpen(true);
    setError(null);
  };

  const openEdit = (r: Review) => {
    setEditTarget(r);
    setForm({
      userId: r.userId, reviewerId: r.reviewerId, reviewPeriod: r.reviewPeriod,
      rating: r.rating, goals: r.goals ?? "", achievements: r.achievements ?? "",
      improvements: r.improvements ?? "", comments: r.comments ?? "",
      reviewDate: r.reviewDate?.slice(0, 10) ?? "",
    });
    setModalOpen(true);
    setError(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        ...form,
        goals: form.goals || null, achievements: form.achievements || null,
        improvements: form.improvements || null, comments: form.comments || null,
      };
      if (editTarget) {
        await apiFetch("/api/admin/hr/performance", { method: "PATCH", body: JSON.stringify({ id: editTarget.id, ...body }) });
        setSuccess("Review updated.");
      } else {
        await apiFetch("/api/admin/hr/performance", { method: "POST", body: JSON.stringify(body) });
        setSuccess("Review created.");
      }
      setModalOpen(false);
      await load();
    } catch (e: any) { setError(e?.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/admin/hr/performance?id=${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      setSuccess("Review deleted.");
      await load();
    } catch (e: any) { setError(e?.message ?? "Failed"); }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Performance Reviews</h1>
            <p className="text-sm text-zinc-500">Track employee performance, goals, and appraisals</p>
          </div>
          <Button onClick={openCreate}>+ New Review</Button>
        </div>

        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {success && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

        <Card>
          <div className="mb-4 flex flex-wrap gap-3">
            <Input className="max-w-xs" placeholder="Search name, period, dept..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Reviewer</th>
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
                    <td className="px-4 py-3 text-zinc-600">{r.reviewPeriod}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-lg px-2 py-1 text-xs font-medium ${RATING_COLORS[r.rating] ?? "bg-zinc-100 text-zinc-600"}`}>
                        {RATING_LABELS[r.rating] ?? r.rating}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">{r.reviewer.name}</td>
                    <td className="px-4 py-3 text-zinc-600 hidden md:table-cell">{r.reviewDate?.slice(0, 10)}</td>
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
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400">{loading ? "Loading..." : "No reviews found."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {modalOpen && (
        <Modal title={editTarget ? "Edit Review" : "New Performance Review"} onClose={() => setModalOpen(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Employee *</label>
                <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm">
                  <option value="">— Select —</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Reviewer *</label>
                <select value={form.reviewerId} onChange={(e) => setForm({ ...form, reviewerId: e.target.value })} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm">
                  <option value="">— Select —</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Review Period *</label>
                <Input value={form.reviewPeriod} onChange={(e) => setForm({ ...form, reviewPeriod: e.target.value })} placeholder="e.g. Q1 2025" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Review Date *</label>
                <Input type="date" value={form.reviewDate} onChange={(e) => setForm({ ...form, reviewDate: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Rating *</label>
              <select value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm">
                {Object.entries(RATING_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            {[
              { key: "goals", label: "Goals" },
              { key: "achievements", label: "Achievements" },
              { key: "improvements", label: "Areas for Improvement" },
              { key: "comments", label: "Overall Comments" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium">{label}</label>
                <textarea value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} rows={2} className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm" placeholder="Optional..." />
              </div>
            ))}
            {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving || !form.userId || !form.reviewerId || !form.reviewDate} className="flex-1">
                {saving ? "Saving..." : editTarget ? "Save Changes" : "Create Review"}
              </Button>
              <Button variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
            </div>
          </div>
        </Modal>
      )}

      {viewTarget && (
        <Modal title={`Review — ${viewTarget.user.name}`} onClose={() => setViewTarget(null)}>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Period</span><strong>{viewTarget.reviewPeriod}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Rating</span>
              <span className={`rounded-lg px-2 py-1 text-xs font-medium ${RATING_COLORS[viewTarget.rating]}`}>{RATING_LABELS[viewTarget.rating]}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Reviewer</span><strong>{viewTarget.reviewer.name}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Date</span><span>{viewTarget.reviewDate?.slice(0, 10)}</span>
            </div>
            {viewTarget.goals && <div><div className="font-medium text-zinc-700 mb-1">Goals</div><p className="text-zinc-600 bg-zinc-50 rounded-lg p-3">{viewTarget.goals}</p></div>}
            {viewTarget.achievements && <div><div className="font-medium text-zinc-700 mb-1">Achievements</div><p className="text-zinc-600 bg-emerald-50 rounded-lg p-3">{viewTarget.achievements}</p></div>}
            {viewTarget.improvements && <div><div className="font-medium text-zinc-700 mb-1">Areas for Improvement</div><p className="text-zinc-600 bg-amber-50 rounded-lg p-3">{viewTarget.improvements}</p></div>}
            {viewTarget.comments && <div><div className="font-medium text-zinc-700 mb-1">Comments</div><p className="text-zinc-600 bg-zinc-50 rounded-lg p-3">{viewTarget.comments}</p></div>}
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete Review" onClose={() => setDeleteTarget(null)}>
          <p className="mb-4 text-sm text-zinc-700">Delete {deleteTarget.reviewPeriod} review for <strong>{deleteTarget.user.name}</strong>?</p>
          <div className="flex gap-2">
            <Button variant="danger" onClick={confirmDelete} className="flex-1">Delete</Button>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">Cancel</Button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
