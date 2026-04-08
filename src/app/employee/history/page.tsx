"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/AppShell";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";
import { apiFetch } from "../../../lib/clientApi";
import { getToken, parseJwt } from "../../../lib/clientAuth";

type HistoryRow = {
  date: string;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  officeName: string;
  hoursWorked: number | null;
  isLateArrival: boolean;
  isEarlyDeparture: boolean;
  isOvertime: boolean;
  minutesLate: number | null;
  minutesEarlyDeparture: number | null;
};
type LeaveRow = { id: string; startDate: string; endDate: string; reason: string | null; status: string; createdAt: string; decidedAt: string | null };
type Summary = { presentDays: number; totalHours: number; overtimeHours: number; lateDays: number; approvedLeaves: number; pendingLeaves: number };
type CorrReq = { id: string; workDate: string; requestType: string; intendedCheckIn: string | null; intendedCheckOut: string | null; reason: string; status: string; createdAt: string };

const STATUS_COLORS: Record<string, string> = {
  open: "bg-emerald-50 text-emerald-700",
  overtime: "bg-orange-50 text-orange-700",
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

export default function EmployeeHistoryPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const now = new Date();
  const [startDate, setStartDate] = useState(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
  const [endDate, setEndDate] = useState(() => toDateInputValue(now));
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [corrRequests, setCorrRequests] = useState<CorrReq[]>([]);
  const [showCorrForm, setShowCorrForm] = useState(false);
  const [corrDate, setCorrDate] = useState(() => toDateInputValue(now));
  const [corrType, setCorrType] = useState<"check_in" | "check_out" | "both">("both");
  const [corrCheckIn, setCorrCheckIn] = useState("");
  const [corrCheckOut, setCorrCheckOut] = useState("");
  const [corrReason, setCorrReason] = useState("");
  const [corrLoading, setCorrLoading] = useState(false);
  const [corrError, setCorrError] = useState<string | null>(null);
  const [corrSuccess, setCorrSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ startDate, endDate });
      const [histRes, corrRes] = await Promise.all([
        apiFetch<{ rows: HistoryRow[]; leaves: LeaveRow[]; summary: Summary }>(`/api/employee/history?${qs}`),
        apiFetch<{ requests: CorrReq[] }>("/api/corrections"),
      ]);
      setRows(histRes.rows);
      setLeaves(histRes.leaves);
      setSummary(histRes.summary);
      setCorrRequests(corrRes.requests);
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    load();
  }, [token, startDate, endDate]);

  const downloadCsv = () => {
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Date", "Status", "Check-in", "Check-out", "Office", "Hours Worked"];
    const body = rows.map((r) => [
      r.date, r.status,
      r.checkInAt ? new Date(r.checkInAt).toLocaleString() : "",
      r.checkOutAt ? new Date(r.checkOutAt).toLocaleString() : "",
      r.officeName, r.hoursWorked ?? "",
    ]);
    const csv = [header, ...body].map((row) => row.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-attendance-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const submitCorrection = async () => {
    setCorrLoading(true);
    setCorrError(null);
    setCorrSuccess(null);
    try {
      const body: Record<string, any> = { workDate: corrDate, requestType: corrType, reason: corrReason };
      if ((corrType === "check_in" || corrType === "both") && corrCheckIn) body.intendedCheckIn = new Date(corrCheckIn).toISOString();
      if ((corrType === "check_out" || corrType === "both") && corrCheckOut) body.intendedCheckOut = new Date(corrCheckOut).toISOString();
      await apiFetch("/api/corrections", { method: "POST", body: JSON.stringify(body) });
      setCorrSuccess("Correction request submitted. Admin will review it.");
      setShowCorrForm(false);
      setCorrReason("");
      load();
    } catch (e: any) {
      setCorrError(e?.message ?? "Failed");
    } finally {
      setCorrLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Days Present", value: summary.presentDays, color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
              { label: "Total Hours", value: `${summary.totalHours.toFixed(1)}h`, color: "bg-blue-50 border-blue-200 text-blue-700" },
              { label: "Overtime Hours", value: `${(summary.overtimeHours ?? 0).toFixed(1)}h`, color: "bg-orange-50 border-orange-200 text-orange-700" },
              { label: "Late Days", value: summary.lateDays ?? 0, color: "bg-red-50 border-red-200 text-red-700" },
              { label: "Approved Leaves", value: summary.approvedLeaves, color: "bg-yellow-50 border-yellow-200 text-yellow-700" },
              { label: "Pending Leaves", value: summary.pendingLeaves, color: "bg-zinc-50 border-zinc-200 text-zinc-600" },
            ].map((c) => (
              <div key={c.label} className={`rounded-2xl border p-4 ${c.color.split(" ").slice(0, 2).join(" ")}`}>
                <div className={`text-2xl font-bold ${c.color.split(" ")[2]}`}>{c.value}</div>
                <div className="mt-1 text-xs text-zinc-500">{c.label}</div>
              </div>
            ))}
          </div>
        )}

        <Card title="Attendance History">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36" />
            <span className="text-zinc-400 text-sm">to</span>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36" />
            <Button variant="secondary" onClick={downloadCsv} className="h-9 px-3 text-xs ml-auto">Download CSV</Button>
          </div>
          {error && <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-600 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Check-in</th>
                  <th className="px-4 py-3 text-left">Check-out</th>
                  <th className="px-4 py-3 text-left">Office</th>
                  <th className="px-4 py-3 text-right">Hours</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-zinc-100 hover:bg-zinc-50">
                    <td className="px-4 py-3 text-zinc-500">{r.date}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <span className={`rounded-lg px-2 py-1 text-xs font-medium ${STATUS_COLORS[r.isOvertime ? "overtime" : r.status] ?? "bg-zinc-100 text-zinc-600"}`}>
                          {r.isOvertime ? "overtime" : r.status}
                        </span>
                        {r.isLateArrival && (
                          <span className="rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700" title={`${r.minutesLate} min late`}>
                            Late{r.minutesLate ? ` +${r.minutesLate}m` : ""}
                          </span>
                        )}
                        {r.isEarlyDeparture && (
                          <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700" title={`${r.minutesEarlyDeparture} min early`}>
                            Early out{r.minutesEarlyDeparture ? ` -${r.minutesEarlyDeparture}m` : ""}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600">{r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString() : "-"}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600">{r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString() : "-"}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{r.officeName}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-zinc-700">{r.hoursWorked !== null ? `${r.hoursWorked.toFixed(1)}h` : "-"}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400">{loading ? "Loading…" : "No attendance records."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Forgot to Check In / Check Out?">
          <p className="mb-3 text-sm text-zinc-600">Submit a correction request if you forgot to check in or check out. An admin will review and apply the correction.</p>
          {corrSuccess && <div className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{corrSuccess}</div>}
          {!showCorrForm ? (
            <Button onClick={() => setShowCorrForm(true)} variant="secondary">Submit Correction Request</Button>
          ) : (
            <div className="space-y-3 rounded-xl border border-zinc-200 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Work Date</label>
                  <Input type="date" value={corrDate} onChange={(e) => setCorrDate(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Request Type</label>
                  <select className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm" value={corrType} onChange={(e) => setCorrType(e.target.value as any)}>
                    <option value="check_in">Forgot Check-in</option>
                    <option value="check_out">Forgot Check-out</option>
                    <option value="both">Both</option>
                  </select>
                </div>
              </div>
              {(corrType === "check_in" || corrType === "both") && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Intended Check-in Time</label>
                  <Input type="datetime-local" value={corrCheckIn} onChange={(e) => setCorrCheckIn(e.target.value)} />
                </div>
              )}
              {(corrType === "check_out" || corrType === "both") && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Intended Check-out Time</label>
                  <Input type="datetime-local" value={corrCheckOut} onChange={(e) => setCorrCheckOut(e.target.value)} />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Reason</label>
                <Textarea value={corrReason} onChange={(e) => setCorrReason(e.target.value)} placeholder="Explain why you couldn't check in/out at that time…" rows={3} />
              </div>
              {corrError && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{corrError}</div>}
              <div className="flex gap-2">
                <Button onClick={submitCorrection} disabled={corrLoading || !corrReason.trim()}>{corrLoading ? "Submitting…" : "Submit Request"}</Button>
                <Button variant="secondary" onClick={() => { setShowCorrForm(false); setCorrError(null); }}>Cancel</Button>
              </div>
            </div>
          )}

          {corrRequests.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-medium text-zinc-700">My Correction Requests</h3>
              <div className="space-y-2">
                {corrRequests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl border border-zinc-100 px-4 py-3 text-sm">
                    <div>
                      <span className="font-medium text-zinc-900">{new Date(r.workDate).toLocaleDateString()}</span>
                      <span className="ml-2 text-xs text-zinc-500">{r.requestType.replace("_", "-")}</span>
                      <span className="ml-2 text-xs italic text-zinc-400">{r.reason.slice(0, 60)}{r.reason.length > 60 ? "…" : ""}</span>
                    </div>
                    <span className={`rounded-lg px-2 py-1 text-xs font-medium ${r.status === "approved" ? "bg-emerald-50 text-emerald-700" : r.status === "rejected" ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-700"}`}>
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card title="Leave History">
          <div className="space-y-2">
            {leaves.length === 0 ? (
              <p className="text-sm text-zinc-400">No leave requests yet.</p>
            ) : (
              leaves.map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-xl border border-zinc-100 px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium text-zinc-900">{new Date(l.startDate).toLocaleDateString()} – {new Date(l.endDate).toLocaleDateString()}</div>
                    {l.reason && <div className="text-xs text-zinc-500 italic">{l.reason}</div>}
                  </div>
                  <span className={`rounded-lg px-2 py-1 text-xs font-medium ${l.status === "approved" ? "bg-emerald-50 text-emerald-700" : l.status === "rejected" ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-700"}`}>
                    {l.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
