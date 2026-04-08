"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/AppShell";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { apiFetch } from "../../../lib/clientApi";
import { getToken, parseJwt } from "../../../lib/clientAuth";

type UserRow = {
  id: string;
  name: string;
  email: string | null;
  role: "employee" | "manager" | "admin";
  isActive: boolean;
  managerId: string | null;
  employeeId: string | null;
  phone: string | null;
  department: string | null;
  jobTitle: string | null;
  address: string | null;
  photoUrl: string | null;
  createdAt: string;
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-zinc-100 text-zinc-400">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

async function uploadPhoto(file: File): Promise<string> {
  const token = getToken();
  if (!token) throw new Error("Unauthorized");
  const form = new FormData();
  form.set("file", file);
  const res = await fetch("/api/admin/upload", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || "Upload failed");
  return String(data.url || "");
}

export default function AdminUsersPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [rows, setRows] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const managers = useMemo(
    () => rows.filter((r) => r.role === "manager" || r.role === "admin"),
    [rows]
  );

  // ── Create form ──────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPassword, setCPassword] = useState("");
  const [cRole, setCRole] = useState<UserRow["role"]>("employee");
  const [cManagerId, setCManagerId] = useState("");
  const [cEmployeeId, setCEmployeeId] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cDepartment, setCDepartment] = useState("");
  const [cJobTitle, setCJobTitle] = useState("");
  const [cAddress, setCAddress] = useState("");
  const [cPhotoFile, setCPhotoFile] = useState<File | null>(null);
  const [cPhotoUrl, setCPhotoUrl] = useState("");
  const [cPhotoPreview, setCPhotoPreview] = useState<string | null>(null);
  const [cLoading, setCLoading] = useState(false);

  // ── Edit form ─────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [eName, setEName] = useState("");
  const [eEmail, setEEmail] = useState("");
  const [ePassword, setEPassword] = useState("");
  const [eRole, setERole] = useState<UserRow["role"]>("employee");
  const [eIsActive, setEIsActive] = useState(true);
  const [eEmployeeId, setEEmployeeId] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [eDepartment, setEDepartment] = useState("");
  const [eJobTitle, setEJobTitle] = useState("");
  const [eAddress, setEAddress] = useState("");
  const [eManagerId, setEManagerId] = useState("");
  const [ePhotoFile, setEPhotoFile] = useState<File | null>(null);
  const [ePhotoUrl, setEPhotoUrl] = useState("");
  const [ePhotoPreview, setEPhotoPreview] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // ── Delete ────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (!token) router.push("/login");
    if (user && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  const load = async () => {
    const res = await apiFetch<{ users: UserRow[] }>("/api/admin/users");
    setRows(res.users);
  };

  useEffect(() => {
    load().catch(() => setRows([]));
  }, []);

  const openEdit = (u: UserRow) => {
    setEditTarget(u);
    setEName(u.name);
    setEEmail(u.email ?? "");
    setEPassword("");
    setERole(u.role);
    setEIsActive(u.isActive);
    setEEmployeeId(u.employeeId ?? "");
    setEPhone(u.phone ?? "");
    setEDepartment(u.department ?? "");
    setEJobTitle(u.jobTitle ?? "");
    setEAddress(u.address ?? "");
    setEManagerId(u.managerId ?? "");
    setEPhotoFile(null);
    setEPhotoUrl(u.photoUrl ?? "");
    setEPhotoPreview(u.photoUrl ?? null);
    setEditError(null);
  };

  const handleEPhotoChange = (file: File | null) => {
    setEPhotoFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setEPhotoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCPhotoChange = (file: File | null) => {
    setCPhotoFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setCPhotoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setEditLoading(true);
    setEditError(null);
    try {
      let finalPhotoUrl = ePhotoUrl.trim() || null;
      if (ePhotoFile) {
        finalPhotoUrl = await uploadPhoto(ePhotoFile);
      }

      const body: Record<string, unknown> = {
        name: eName,
        email: eEmail,
        role: eRole,
        isActive: eIsActive,
        employeeId: eEmployeeId.trim() || null,
        phone: ePhone.trim() || null,
        department: eDepartment.trim() || null,
        jobTitle: eJobTitle.trim() || null,
        address: eAddress.trim() || null,
        managerId: eManagerId.trim() || null,
        photoUrl: finalPhotoUrl,
      };
      if (ePassword.trim()) body.password = ePassword.trim();

      await apiFetch(`/api/admin/users/${editTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setEditTarget(null);
      setSuccess("User updated.");
      await load();
    } catch (e: any) {
      setEditError(e?.message ?? "Failed to update");
    } finally {
      setEditLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await apiFetch(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      setSuccess("User deleted.");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete");
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const createUser = async () => {
    setCLoading(true);
    setError(null);
    setSuccess(null);
    try {
      let uploadedUrl = cPhotoUrl.trim();
      if (cPhotoFile) {
        uploadedUrl = await uploadPhoto(cPhotoFile);
      }

      await apiFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: cName, email: cEmail, password: cPassword, role: cRole,
          managerId: cManagerId.trim() || undefined,
          employeeId: cEmployeeId.trim() || undefined,
          phone: cPhone.trim() || undefined,
          department: cDepartment.trim() || undefined,
          jobTitle: cJobTitle.trim() || undefined,
          address: cAddress.trim() || undefined,
          photoUrl: uploadedUrl || undefined,
        }),
      });
      setCName(""); setCEmail(""); setCPassword(""); setCManagerId("");
      setCRole("employee"); setCEmployeeId(""); setCPhone(""); setCDepartment("");
      setCJobTitle(""); setCAddress(""); setCPhotoFile(null); setCPhotoUrl(""); setCPhotoPreview(null);
      setCreateOpen(false);
      setSuccess("User created.");
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Failed");
    } finally {
      setCLoading(false);
    }
  };

  return (
    <AppShell>
      <Card title="Users">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex flex-wrap gap-2">
            <a className="rounded-lg px-3 py-2 hover:bg-zinc-100" href="/admin/offices">Offices</a>
            <a className="rounded-lg bg-zinc-100 px-3 py-2 font-medium" href="/admin/users">Users</a>
            <a className="rounded-lg px-3 py-2 hover:bg-zinc-100" href="/admin/qr">Daily QR</a>
            <a className="rounded-lg px-3 py-2 hover:bg-zinc-100" href="/admin/attendance">Attendance</a>
            <a className="rounded-lg px-3 py-2 hover:bg-zinc-100" href="/admin/leaves">Leaves</a>
          </div>
          <Button onClick={() => setCreateOpen(true)}>+ New User</Button>
        </div>

        {error && <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-600">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 hidden sm:table-cell">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 hidden md:table-cell">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {r.photoUrl ? (
                        <img src={r.photoUrl} alt={r.name} className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-medium text-zinc-500 flex-shrink-0">
                          {r.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-zinc-900">{r.name}</div>
                        <div className="text-xs text-zinc-400 sm:hidden">{r.email ?? ""}</div>
                        {r.managerId && (
                          <div className="text-xs text-blue-500">
                            ↳ {rows.find((m) => m.id === r.managerId)?.name ?? "Unknown manager"}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">{r.email ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-lg px-2 py-1 text-xs font-medium ${
                      r.role === "admin" ? "bg-violet-50 text-violet-700" :
                      r.role === "manager" ? "bg-blue-50 text-blue-700" :
                      "bg-zinc-100 text-zinc-600"
                    }`}>
                      {r.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`rounded-lg px-2 py-1 text-xs font-medium ${r.isActive ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                      {r.isActive ? "active" : "disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(r)}
                        className="rounded-lg px-3 py-1.5 text-xs border border-zinc-200 hover:bg-zinc-100"
                      >
                        Edit
                      </button>
                      {r.role !== "admin" && (
                        <button
                          onClick={() => setDeleteTarget(r)}
                          className="rounded-lg px-3 py-1.5 text-xs border border-red-200 text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-zinc-400" colSpan={5}>No users.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Create Modal ── */}
      {createOpen && (
        <Modal title="Create User" onClose={() => setCreateOpen(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Name *</label>
              <Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Email *</label>
              <Input value={cEmail} onChange={(e) => setCEmail(e.target.value)} type="email" placeholder="user@company.com" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Password *</label>
              <Input value={cPassword} onChange={(e) => setCPassword(e.target.value)} type="password" placeholder="Min 6 chars" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Role</label>
              <select value={cRole} onChange={(e) => setCRole(e.target.value as any)} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm">
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Employee ID</label>
              <Input value={cEmployeeId} onChange={(e) => setCEmployeeId(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Phone</label>
              <Input value={cPhone} onChange={(e) => setCPhone(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Department</label>
              <Input value={cDepartment} onChange={(e) => setCDepartment(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Job Title</label>
              <Input value={cJobTitle} onChange={(e) => setCJobTitle(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Address</label>
              <Input value={cAddress} onChange={(e) => setCAddress(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Reports to (Manager)</label>
              <select value={cManagerId} onChange={(e) => setCManagerId(e.target.value)} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm">
                <option value="">— No manager —</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Photo</label>
              {cPhotoPreview && (
                <img src={cPhotoPreview} alt="Preview" className="mb-2 h-20 w-20 rounded-full object-cover border border-zinc-200" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleCPhotoChange(e.target.files?.[0] ?? null)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
              />
              <Input className="mt-2" value={cPhotoUrl} onChange={(e) => setCPhotoUrl(e.target.value)} placeholder="Or paste photo URL" />
            </div>
            {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <Button disabled={cLoading} onClick={createUser} className="w-full">
              {cLoading ? "Creating..." : "Create User"}
            </Button>
          </div>
        </Modal>
      )}

      {/* ── Edit Modal ── */}
      {editTarget && (
        <Modal title={`Edit: ${editTarget.name}`} onClose={() => setEditTarget(null)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Name</label>
              <Input value={eName} onChange={(e) => setEName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Email</label>
              <Input value={eEmail} onChange={(e) => setEEmail(e.target.value)} type="email" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">New Password (leave blank to keep)</label>
              <Input value={ePassword} onChange={(e) => setEPassword(e.target.value)} type="password" placeholder="Min 6 chars" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Role</label>
              <select value={eRole} onChange={(e) => setERole(e.target.value as any)} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm">
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Status</label>
              <select value={eIsActive ? "active" : "disabled"} onChange={(e) => setEIsActive(e.target.value === "active")} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm">
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Employee ID</label>
              <Input value={eEmployeeId} onChange={(e) => setEEmployeeId(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Phone</label>
              <Input value={ePhone} onChange={(e) => setEPhone(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Department</label>
              <Input value={eDepartment} onChange={(e) => setEDepartment(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Job Title</label>
              <Input value={eJobTitle} onChange={(e) => setEJobTitle(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Address</label>
              <Input value={eAddress} onChange={(e) => setEAddress(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Reports to (Manager)</label>
              <select value={eManagerId} onChange={(e) => setEManagerId(e.target.value)} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm">
                <option value="">— No manager —</option>
                {managers.filter((m) => m.id !== editTarget?.id).map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Photo</label>
              {ePhotoPreview && (
                <img src={ePhotoPreview} alt="Preview" className="mb-2 h-20 w-20 rounded-full object-cover border border-zinc-200" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleEPhotoChange(e.target.files?.[0] ?? null)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
              />
              <Input
                className="mt-2"
                value={ePhotoUrl}
                onChange={(e) => { setEPhotoUrl(e.target.value); setEPhotoPreview(e.target.value || null); setEPhotoFile(null); }}
                placeholder="Or paste photo URL"
              />
            </div>
            {editError && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{editError}</div>}
            <div className="flex gap-2">
              <Button disabled={editLoading} onClick={saveEdit} className="flex-1">
                {editLoading ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="secondary" onClick={() => setEditTarget(null)} className="flex-1">Cancel</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <Modal title="Delete User" onClose={() => setDeleteTarget(null)}>
          <p className="mb-4 text-sm text-zinc-700">
            Are you sure you want to delete <span className="font-semibold">{deleteTarget.name}</span>? This will also remove all their attendance records and leave requests. This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button variant="danger" disabled={deleteLoading} onClick={confirmDelete} className="flex-1">
              {deleteLoading ? "Deleting..." : "Yes, Delete"}
            </Button>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">Cancel</Button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
