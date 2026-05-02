"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/AppShell";
import { Card } from "../../../components/ui/Card";
import { apiFetch } from "../../../lib/clientApi";
import { getToken, parseJwt } from "../../../lib/clientAuth";
import { Button } from "../../../components/ui/Button";

type Stat = { totalActive: number; presentCount: number; absentCount: number; onLeaveCount: number; onOutstationCount: number; pendingLeaves: number; pendingCorrections: number };
type CheckedInRow = { userId: string; name: string; email: string | null; officeName: string | null; checkInAt: string | null; checkOutAt: string | null; status: string };
type PendingLeave = { id: string; startDate: string; endDate: string; reason: string | null; createdAt: string; user: { id: string; name: string; email: string | null } };
type AbsentUser = { id: string; name: string; email: string | null; department: string | null; jobTitle: string | null };

export default function AdminDashboardPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [stats, setStats] = useState<Stat | null>(null);
  const [checkedIn, setCheckedIn] = useState<CheckedInRow[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<PendingLeave[]>([]);
  const [absentUsers, setAbsentUsers] = useState<AbsentUser[]>([]);
  const [holiday, setHoliday] = useState<{ name: string } | null>(null);
  const [isOffDay, setIsOffDay] = useState(false);
  const [showAbsent, setShowAbsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
    if (user && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ stats: Stat; checkedIn: CheckedInRow[]; pendingLeaves: PendingLeave[]; absentUsers: AbsentUser[]; holiday: { name: string } | null; isOffDay: boolean }>("/api/admin/dashboard");
      setStats(res.stats);
      setCheckedIn(res.checkedIn);
      setPendingLeaves(res.pendingLeaves);
      setAbsentUsers(res.absentUsers ?? []);
      setHoliday(res.holiday ?? null);
      setIsOffDay(res.isOffDay ?? false);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [token]);

  const decide = async (id: string, status: "approved" | "rejected") => {
    setDeciding(id);
    try {
      await apiFetch("/api/admin/leaves", { method: "POST", body: JSON.stringify({ id, status }) });
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setDeciding(null);
    }
  };

  const statCards = [
    { label: "Active Employees", value: stats?.totalActive ?? "-", color: "bg-zinc-50 border-zinc-200", text: "text-zinc-900", onClick: undefined as undefined | (() => void) },
    { label: "Present Today", value: stats?.presentCount ?? "-", color: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", onClick: undefined },
    { label: "Absent Today", value: stats?.absentCount ?? "-", color: "bg-red-50 border-red-200", text: "text-red-700", onClick: () => setShowAbsent((v) => !v) },
    { label: "On Leave", value: stats?.onLeaveCount ?? "-", color: "bg-yellow-50 border-yellow-200", text: "text-yellow-700", onClick: undefined },
    { label: "On Outstation", value: stats?.onOutstationCount ?? "-", color: "bg-cyan-50 border-cyan-200", text: "text-cyan-700", onClick: undefined },
    { label: "Pending Leaves", value: stats?.pendingLeaves ?? "-", color: "bg-blue-50 border-blue-200", text: "text-blue-700", onClick: undefined },
    { label: "Pending Corrections", value: stats?.pendingCorrections ?? "-", color: "bg-purple-50 border-purple-200", text: "text-purple-700", onClick: undefined },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-zinc-900">Live Dashboard</h1>
          <Button variant="secondary" onClick={load} disabled={loading} className="h-9 px-3 text-xs">
            {loading ? "Refreshing…" : "↻ Refresh"}
          </Button>
        </div>

        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {/* Holiday / Off Day banners */}
        {holiday && (
          <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
            <span className="text-xl">🏖️</span>
            <div>
              <div className="text-sm font-semibold text-indigo-800">Office Holiday — {holiday.name}</div>
              <div className="text-xs text-indigo-600">Today is a declared holiday. Attendance figures reflect actual check-ins only.</div>
            </div>
          </div>
        )}
        {isOffDay && !holiday && (
          <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
            <span className="text-xl">📅</span>
            <div>
              <div className="text-sm font-semibold text-violet-800">Weekly Off Day</div>
              <div className="text-xs text-violet-600">Staff are not expected to attend today. Absent count only reflects workday-override holders.</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {statCards.map((c) => (
            <div
              key={c.label}
              className={`rounded-2xl border p-4 ${c.color} ${c.onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
              onClick={c.onClick}
            >
              <div className={`text-2xl font-bold ${c.text}`}>{c.value}</div>
              <div className="mt-1 text-xs text-zinc-500">{c.label}</div>
              {c.onClick && <div className="mt-1 text-[10px] text-zinc-400">Click to {showAbsent ? "hide" : "view"}</div>}
            </div>
          ))}
        </div>

        {/* Absent employees expandable list */}
        {showAbsent && absentUsers.length > 0 && (
          <Card title={`Absent Today (${absentUsers.length})`}>
            <div className="divide-y divide-zinc-100">
              {absentUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-semibold text-red-700">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-zinc-900 text-sm">{u.name}</div>
                    <div className="text-xs text-zinc-400">{u.department ?? ""}{u.jobTitle ? ` · ${u.jobTitle}` : ""}</div>
                  </div>
                  <div className="text-xs text-zinc-400">{u.email ?? ""}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
        {showAbsent && absentUsers.length === 0 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            No absent employees today.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={`Checked In Today (${checkedIn.length})`}>
            {checkedIn.length === 0 ? (
              <p className="text-sm text-zinc-400">{loading ? "Loading…" : "No one has checked in yet."}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-zinc-500">
                      <th className="pb-2">Employee</th>
                      <th className="pb-2">Office</th>
                      <th className="pb-2">Check-in</th>
                      <th className="pb-2">Check-out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkedIn.map((r) => (
                      <tr key={r.userId} className="border-t border-zinc-100">
                        <td className="py-2">
                          <div className="font-medium text-zinc-900">{r.name}</div>
                          <div className="text-xs text-zinc-400">{r.email ?? ""}</div>
                        </td>
                        <td className="py-2 text-zinc-500 text-xs">{r.officeName ?? "-"}</td>
                        <td className="py-2 text-xs text-zinc-600">{r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString() : "-"}</td>
                        <td className="py-2 text-xs text-zinc-600">{r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString() : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title={`Pending Leave Requests (${pendingLeaves.length})`}>
            {pendingLeaves.length === 0 ? (
              <p className="text-sm text-zinc-400">{loading ? "Loading…" : "No pending leave requests."}</p>
            ) : (
              <div className="space-y-3">
                {pendingLeaves.map((l) => (
                  <div key={l.id} className="rounded-xl border border-zinc-100 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-zinc-900 text-sm">{l.user.name}</div>
                        <div className="text-xs text-zinc-400">{l.user.email}</div>
                        <div className="mt-1 text-xs text-zinc-600">
                          {new Date(l.startDate).toLocaleDateString()} – {new Date(l.endDate).toLocaleDateString()}
                        </div>
                        {l.reason && <div className="mt-1 text-xs text-zinc-500 italic">{l.reason}</div>}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => decide(l.id, "approved")}
                          disabled={deciding === l.id}
                          className="rounded-lg bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500 disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => decide(l.id, "rejected")}
                          disabled={deciding === l.id}
                          className="rounded-lg bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-500 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <a href="/admin/corrections" className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-purple-700 hover:bg-purple-100">
            Review Correction Requests
          </a>
          <a href="/admin/attendance" className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-zinc-700 hover:bg-zinc-50">
            Full Attendance Report
          </a>
          <a href="/admin/hours" className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-zinc-700 hover:bg-zinc-50">
            Work Hours Report
          </a>
        </div>
      </div>
    </AppShell>
  );
}
