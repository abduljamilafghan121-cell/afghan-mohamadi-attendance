"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/AppShell";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { apiFetch } from "../../../lib/clientApi";
import { getToken, parseJwt } from "../../../lib/clientAuth";

type UserRow = { id: string; name: string; email: string | null; employeeId: string | null; department: string | null };
type BalanceRow = {
  id: string | null;
  leaveType: "annual" | "sick" | "casual" | "unpaid";
  entitlementDays: number;
  carriedOverDays: number;
  usedDays: number;
  remainingDays: number;
  notes: string | null;
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "Annual",
  sick: "Sick",
  casual: "Casual",
  unpaid: "Unpaid",
};

const LEAVE_TYPE_COLORS: Record<string, string> = {
  annual: "bg-blue-50 text-blue-700",
  sick: "bg-red-50 text-red-700",
  casual: "bg-amber-50 text-amber-700",
  unpaid: "bg-zinc-50 text-zinc-700",
};

export default function AdminLeaveBalancePage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [editType, setEditType] = useState<string | null>(null);
  const [editEntitlement, setEditEntitlement] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [carryOverYear, setCarryOverYear] = useState(new Date().getFullYear() - 1);
  const [carryOverLoading, setCarryOverLoading] = useState(false);
  const [carryOverMsg, setCarryOverMsg] = useState<string | null>(null);
  const [carryOverErr, setCarryOverErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
    if (user && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  const load = async (uid?: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ year: String(year) });
      if (uid ?? selectedUserId) qs.set("userId", uid ?? selectedUserId);
      const res = await apiFetch<{ users: UserRow[]; balances: BalanceRow[]; year: number }>(
        `/api/admin/leave-balance?${qs.toString()}`
      );
      setUsers(res.users);
      setBalances(res.balances);
      if (!selectedUserId && res.users.length > 0) {
        setSelectedUserId(res.users[0].id);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    load();
  }, [token]);

  useEffect(() => {
    if (!token || !selectedUserId) return;
    load(selectedUserId);
  }, [selectedUserId, year]);

  const startEdit = (b: BalanceRow) => {
    setEditType(b.leaveType);
    setEditEntitlement(String(b.entitlementDays));
    setEditNotes(b.notes ?? "");
    setSuccess(null);
    setError(null);
  };

  const cancelEdit = () => {
    setEditType(null);
    setEditEntitlement("");
    setEditNotes("");
  };

  const saveBalance = async () => {
    if (!editType || !selectedUserId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch("/api/admin/leave-balance", {
        method: "POST",
        body: JSON.stringify({
          userId: selectedUserId,
          year,
          leaveType: editType,
          entitlementDays: parseFloat(editEntitlement) || 0,
          notes: editNotes.trim() || undefined,
        }),
      });
      setSuccess("Balance updated.");
      cancelEdit();
      await load(selectedUserId);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const runCarryOver = async () => {
    setCarryOverLoading(true);
    setCarryOverMsg(null);
    setCarryOverErr(null);
    try {
      const res = await apiFetch<{ processed: number; fromYear: number; toYear: number }>(
        "/api/admin/leave-balance/carry-over",
        { method: "POST", body: JSON.stringify({ fromYear: carryOverYear }) }
      );
      setCarryOverMsg(`Done — ${res.processed} balance(s) carried over from ${res.fromYear} to ${res.toYear}.`);
      if (year === carryOverYear + 1) await load(selectedUserId);
    } catch (e: any) {
      setCarryOverErr(e?.message ?? "Failed");
    } finally {
      setCarryOverLoading(false);
    }
  };

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Leave Balance</h1>
        <p className="text-sm text-zinc-500">Set entitlement days and track usage per employee per year.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Employee Leave Balances">
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="col-span-2 sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-zinc-600">Employee</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}{u.employeeId ? ` (${u.employeeId})` : ""}{u.department ? ` — ${u.department}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Year</label>
                <select
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            {success && <div className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

            {loading ? (
              <div className="py-8 text-center text-sm text-zinc-400">Loading…</div>
            ) : (
              <div className="space-y-3">
                {balances.map((b) => (
                  <div key={b.leaveType} className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${LEAVE_TYPE_COLORS[b.leaveType]}`}>
                          {LEAVE_TYPE_LABELS[b.leaveType]}
                        </span>
                        {b.leaveType !== "unpaid" && (
                          <span className="text-sm text-zinc-500">
                            {b.entitlementDays} days entitlement
                            {b.carriedOverDays > 0 && ` + ${b.carriedOverDays} carried over`}
                          </span>
                        )}
                      </div>
                      {editType !== b.leaveType && (
                        <Button variant="secondary" onClick={() => startEdit(b)} className="h-8 px-3 text-xs">
                          {b.id ? "Edit" : "Set"}
                        </Button>
                      )}
                    </div>

                    {b.leaveType !== "unpaid" && (
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                        <div className="rounded-lg bg-zinc-50 py-2">
                          <div className="text-xs text-zinc-500">Used</div>
                          <div className="font-semibold text-zinc-900">{b.usedDays}d</div>
                        </div>
                        <div className="rounded-lg bg-zinc-50 py-2">
                          <div className="text-xs text-zinc-500">Total</div>
                          <div className="font-semibold text-zinc-900">{b.entitlementDays + b.carriedOverDays}d</div>
                        </div>
                        <div className={`rounded-lg py-2 ${b.remainingDays > 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                          <div className="text-xs text-zinc-500">Remaining</div>
                          <div className={`font-semibold ${b.remainingDays > 0 ? "text-emerald-700" : "text-red-700"}`}>
                            {b.remainingDays}d
                          </div>
                        </div>
                      </div>
                    )}

                    {b.leaveType === "unpaid" && (
                      <div className="mt-2 text-sm text-zinc-500">
                        Used: <strong>{b.usedDays} days</strong> (no entitlement limit)
                      </div>
                    )}

                    {b.notes && <div className="mt-2 text-xs text-zinc-400">Note: {b.notes}</div>}

                    {editType === b.leaveType && (
                      <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-zinc-700">Entitlement Days</label>
                            <Input
                              type="number"
                              min="0"
                              max="365"
                              step="0.5"
                              value={editEntitlement}
                              onChange={(e) => setEditEntitlement(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-zinc-700">Notes (optional)</label>
                            <Input
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              placeholder="e.g. Prorated"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={saveBalance} disabled={saving} className="h-9 px-4 text-sm">
                            {saving ? "Saving…" : "Save"}
                          </Button>
                          <Button variant="secondary" onClick={cancelEdit} className="h-9 px-4 text-sm">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Carry-Over">
            <p className="text-sm text-zinc-600 mb-4">
              Roll unused leave days from one year into the next. Respects the carry-over limit set in Organization settings.
            </p>
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-zinc-600">Carry over from year</label>
              <select
                value={carryOverYear}
                onChange={(e) => setCarryOverYear(parseInt(e.target.value))}
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm"
              >
                {[currentYear - 2, currentYear - 1, currentYear].map((y) => (
                  <option key={y} value={y}>{y} → {y + 1}</option>
                ))}
              </select>
            </div>
            {carryOverErr && <div className="mb-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">{carryOverErr}</div>}
            {carryOverMsg && <div className="mb-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{carryOverMsg}</div>}
            <Button onClick={runCarryOver} disabled={carryOverLoading} className="w-full">
              {carryOverLoading ? "Running…" : "Run Carry-Over"}
            </Button>
            <p className="mt-2 text-xs text-zinc-400">Applies to Annual, Sick, and Casual leave. Safe to run multiple times (incremental).</p>
          </Card>

          {selectedUser && (
            <Card title="Selected Employee">
              <dl className="space-y-2 text-sm">
                <div><dt className="text-xs text-zinc-500">Name</dt><dd className="text-zinc-900 font-medium">{selectedUser.name}</dd></div>
                {selectedUser.email && <div><dt className="text-xs text-zinc-500">Email</dt><dd className="text-zinc-700">{selectedUser.email}</dd></div>}
                {selectedUser.employeeId && <div><dt className="text-xs text-zinc-500">Employee ID</dt><dd className="text-zinc-700">{selectedUser.employeeId}</dd></div>}
                {selectedUser.department && <div><dt className="text-xs text-zinc-500">Department</dt><dd className="text-zinc-700">{selectedUser.department}</dd></div>}
              </dl>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
