"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../components/AppShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { apiFetch } from "../../lib/clientApi";
import { getToken, parseJwt } from "../../lib/clientAuth";

type TeamRow = {
  userId: string;
  userName: string;
  email: string | null;
  department: string | null;
  date: string;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  officeName: string | null;
};

type LeaveRow = {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  decidedAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string | null };
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-emerald-50 text-emerald-700",
  closed: "bg-blue-50 text-blue-700",
  absent: "bg-red-50 text-red-700",
  leave: "bg-yellow-50 text-yellow-700",
  corrected: "bg-purple-50 text-purple-700",
  needs_approval: "bg-orange-50 text-orange-700",
};

function toDateInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function ManagerPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [tab, setTab] = useState<"attendance" | "leaves">("attendance");
  const [startDate, setStartDate] = useState(() => toDateInputValue(new Date()));
  const [endDate, setEndDate] = useState(() => toDateInputValue(new Date()));
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [leaveStatus, setLeaveStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
    if (user && user.role !== "manager" && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  const loadAttendance = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ startDate, endDate });
      const res = await apiFetch<{ rows: TeamRow[]; leaves: LeaveRow[] }>(`/api/manager/team?${qs}`);
      setRows(res.rows);
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  const loadLeaves = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ leaves: LeaveRow[] }>(`/api/manager/leaves?status=${leaveStatus}`);
      setLeaves(res.leaves);
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    if (tab === "attendance") loadAttendance();
    else loadLeaves();
  }, [token, tab, startDate, endDate, leaveStatus]);

  const decide = async (id: string, status: "approved" | "rejected") => {
    setDeciding(id);
    setError(null);
    try {
      await apiFetch("/api/manager/leaves", { method: "POST", body: JSON.stringify({ id, status }) });
      await loadLeaves();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setDeciding(null);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1 w-fit">
          <button
            onClick={() => setTab("attendance")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === "attendance" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
          >
            Team Attendance
          </button>
          <button
            onClick={() => setTab("leaves")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === "leaves" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
          >
            Leave Requests
          </button>
        </div>

        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {tab === "attendance" && (
          <Card title="Team Attendance">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36" />
              <span className="text-zinc-400 text-sm">to</span>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs text-zinc-600 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Employee</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Check-in</th>
                    <th className="px-4 py-3 text-left">Check-out</th>
                    <th className="px-4 py-3 text-left">Office</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-zinc-100 hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">{r.userName}</div>
                        <div className="text-xs text-zinc-400">{r.department ?? ""}</div>
                      </td>
                      <td className="px-4 py-3 text-zinc-500">{r.date}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-lg px-2 py-1 text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-zinc-100 text-zinc-600"}`}>{r.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600">{r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString() : "-"}</td>
                      <td className="px-4 py-3 text-xs text-zinc-600">{r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString() : "-"}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{r.officeName ?? "-"}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400">{loading ? "Loading…" : "No team members or no data for this period."}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === "leaves" && (
          <Card title="Team Leave Requests">
            <div className="mb-4 flex items-center gap-2">
              <label className="text-xs text-zinc-500">Status</label>
              <select
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                value={leaveStatus}
                onChange={(e) => setLeaveStatus(e.target.value as any)}
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All</option>
              </select>
            </div>
            <div className="space-y-3">
              {leaves.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-400">{loading ? "Loading…" : "No leave requests."}</p>
              ) : (
                leaves.map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-xl border border-zinc-100 p-4">
                    <div>
                      <div className="font-medium text-zinc-900">{l.user.name}</div>
                      <div className="text-xs text-zinc-400">{l.user.email}</div>
                      <div className="mt-1 text-sm text-zinc-600">
                        {new Date(l.startDate).toLocaleDateString()} – {new Date(l.endDate).toLocaleDateString()}
                      </div>
                      {l.reason && <div className="mt-1 text-xs italic text-zinc-500">{l.reason}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-lg px-2 py-1 text-xs font-medium ${l.status === "approved" ? "bg-emerald-50 text-emerald-700" : l.status === "rejected" ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-700"}`}>
                        {l.status}
                      </span>
                      {l.status === "pending" && (
                        <>
                          <Button onClick={() => decide(l.id, "approved")} disabled={deciding === l.id} className="h-9 px-3 text-xs">Approve</Button>
                          <Button variant="danger" onClick={() => decide(l.id, "rejected")} disabled={deciding === l.id} className="h-9 px-3 text-xs">Reject</Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
