"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../../components/AppShell";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { apiFetch } from "../../../../lib/clientApi";
import { getToken, parseJwt } from "../../../../lib/clientAuth";
import { downloadTextFile } from "../../../../lib/exportUtils";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

type AbsentData = {
  type: "absent_today";
  absent: { id: string; name: string; email: string | null; department: string | null; jobTitle: string | null; phone: string | null }[];
  onLeave: { id: string; name: string; department: string | null }[];
  present: { id: string; name: string; department: string | null }[];
  total: number;
};

type SummaryRow = {
  userId: string; userName: string; department: string | null;
  present: number; absent: number; late: number; earlyDeparture: number;
  overtime: number; leaveDays: number; totalHours: number;
};

type LateRow = { userId: string; userName: string; department: string | null; date: string; checkInAt: string | null; minutesLate: number };
type OvertimeRow = { userId: string; userName: string; department: string | null; date: string; checkInAt: string | null; checkOutAt: string | null; hoursWorked: number | null };

export default function HRReportsPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const jwtUser = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const now = new Date();
  const [activeTab, setActiveTab] = useState<"absent_today" | "monthly_summary" | "late_arrivals" | "overtime">("absent_today");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
    if (jwtUser && jwtUser.role !== "admin") router.push("/employee");
  }, [token, jwtUser, router]);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams({ type: activeTab, month: String(month), year: String(year) });
      const res = await apiFetch<any>(`/api/admin/hr/reports?${qs}`);
      setData(res);
    } catch (e: any) { setError(e?.message ?? "Failed"); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (token) load(); }, [token, activeTab, month, year]);

  const exportCsv = () => {
    if (!data) return;
    let csv = "";
    if (activeTab === "absent_today") {
      csv = "Name,Department,Job Title,Phone,Status\n" +
        (data.absent ?? []).map((u: any) => `"${u.name}","${u.department ?? ""}","${u.jobTitle ?? ""}","${u.phone ?? ""}","Absent"`).join("\n") +
        "\n" +
        (data.onLeave ?? []).map((u: any) => `"${u.name}","${u.department ?? ""}","","","On Leave"`).join("\n");
    } else if (activeTab === "monthly_summary") {
      csv = "Employee,Department,Present,Late,Early Dep,Overtime,Leave Days,Total Hours\n" +
        (data.summaries ?? []).map((r: SummaryRow) =>
          `"${r.userName}","${r.department ?? ""}",${r.present},${r.late},${r.earlyDeparture},${r.overtime},${r.leaveDays},${r.totalHours}`
        ).join("\n");
    } else if (activeTab === "late_arrivals") {
      csv = "Employee,Department,Date,Minutes Late\n" +
        (data.rows ?? []).map((r: LateRow) => `"${r.userName}","${r.department ?? ""}",${r.date},${r.minutesLate}`).join("\n");
    } else if (activeTab === "overtime") {
      csv = "Employee,Department,Date,Hours Worked\n" +
        (data.rows ?? []).map((r: OvertimeRow) => `"${r.userName}","${r.department ?? ""}",${r.date},${r.hoursWorked ?? ""}`).join("\n");
    }
    downloadTextFile(`hr_report_${activeTab}.csv`, csv, "text/csv");
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  const tabs = [
    { id: "absent_today", label: "Absent Today" },
    { id: "monthly_summary", label: "Monthly Summary" },
    { id: "late_arrivals", label: "Late Arrivals" },
    { id: "overtime", label: "Overtime" },
  ] as const;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">HR Reports</h1>
            <p className="text-sm text-zinc-500">Attendance summaries, late arrivals, overtime, and more</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={load}>Refresh</Button>
            <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${activeTab === t.id ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Month/Year filters (not for absent today) */}
        {activeTab !== "absent_today" && (
          <div className="flex flex-wrap gap-3">
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm">
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}

        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {loading && <div className="rounded-xl bg-zinc-50 p-6 text-center text-sm text-zinc-400">Loading report...</div>}

        {/* ABSENT TODAY */}
        {!loading && activeTab === "absent_today" && data && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Present", value: data.present?.length ?? 0, color: "bg-emerald-50 text-emerald-700" },
                { label: "Absent", value: data.absent?.length ?? 0, color: "bg-red-50 text-red-700" },
                { label: "On Leave", value: data.onLeave?.length ?? 0, color: "bg-amber-50 text-amber-700" },
              ].map((c) => (
                <div key={c.label} className={`rounded-2xl border p-4 ${c.color}`}>
                  <div className="text-2xl font-bold">{c.value}</div>
                  <div className="text-xs opacity-70 mt-1">{c.label} / {data.total} total</div>
                </div>
              ))}
            </div>

            {data.absent?.length > 0 && (
              <Card title="Absent Employees">
                <div className="divide-y divide-zinc-100">
                  {data.absent.map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between py-3">
                      <div>
                        <div className="font-medium text-zinc-900">{u.name}</div>
                        <div className="text-xs text-zinc-400">{u.department ?? ""}{u.jobTitle ? ` · ${u.jobTitle}` : ""}</div>
                      </div>
                      {u.phone && <div className="text-xs text-zinc-500">{u.phone}</div>}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {data.onLeave?.length > 0 && (
              <Card title="On Leave Today">
                <div className="divide-y divide-zinc-100">
                  {data.onLeave.map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between py-3">
                      <div className="font-medium text-zinc-900">{u.name}</div>
                      <div className="text-xs text-zinc-400">{u.department ?? ""}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* MONTHLY SUMMARY */}
        {!loading && activeTab === "monthly_summary" && data && (
          <Card title={`${MONTHS[month - 1]} ${year} — Attendance Summary`}>
            <div className="overflow-x-auto rounded-xl border border-zinc-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Present</th>
                    <th className="px-4 py-3">Late</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Early Dep.</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Overtime</th>
                    <th className="px-4 py-3 hidden md:table-cell">Leave Days</th>
                    <th className="px-4 py-3 hidden md:table-cell">Total Hrs</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.summaries ?? []).map((r: SummaryRow) => (
                    <tr key={r.userId} className="border-t border-zinc-100 hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">{r.userName}</div>
                        <div className="text-xs text-zinc-400">{r.department ?? ""}</div>
                      </td>
                      <td className="px-4 py-3"><span className="rounded-lg bg-emerald-50 text-emerald-700 px-2 py-1 text-xs font-medium">{r.present}</span></td>
                      <td className="px-4 py-3"><span className={`rounded-lg px-2 py-1 text-xs font-medium ${r.late > 0 ? "bg-amber-50 text-amber-700" : "bg-zinc-50 text-zinc-400"}`}>{r.late}</span></td>
                      <td className="px-4 py-3 hidden sm:table-cell text-zinc-600">{r.earlyDeparture}</td>
                      <td className="px-4 py-3 hidden sm:table-cell text-zinc-600">{r.overtime}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-zinc-600">{r.leaveDays}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-zinc-600">{r.totalHours}h</td>
                    </tr>
                  ))}
                  {(data.summaries ?? []).length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-400">No data for this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* LATE ARRIVALS */}
        {!loading && activeTab === "late_arrivals" && data && (
          <Card title={`Late Arrivals — ${MONTHS[month - 1]} ${year}`}>
            <div className="overflow-x-auto rounded-xl border border-zinc-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Check-In</th>
                    <th className="px-4 py-3">Minutes Late</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.rows ?? []).map((r: LateRow, i: number) => (
                    <tr key={i} className="border-t border-zinc-100 hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">{r.userName}</div>
                        <div className="text-xs text-zinc-400">{r.department ?? ""}</div>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{r.date}</td>
                      <td className="px-4 py-3 text-zinc-600">{r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td className="px-4 py-3"><span className="rounded-lg bg-amber-50 text-amber-700 px-2 py-1 text-xs font-medium">{r.minutesLate} min</span></td>
                    </tr>
                  ))}
                  {(data.rows ?? []).length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-400">No late arrivals for this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* OVERTIME */}
        {!loading && activeTab === "overtime" && data && (
          <Card title={`Overtime — ${MONTHS[month - 1]} ${year}`}>
            <div className="overflow-x-auto rounded-xl border border-zinc-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Check-In</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Check-Out</th>
                    <th className="px-4 py-3">Hours Worked</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.rows ?? []).map((r: OvertimeRow, i: number) => (
                    <tr key={i} className="border-t border-zinc-100 hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">{r.userName}</div>
                        <div className="text-xs text-zinc-400">{r.department ?? ""}</div>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{r.date}</td>
                      <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">{r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">{r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td className="px-4 py-3"><span className="rounded-lg bg-orange-50 text-orange-700 px-2 py-1 text-xs font-medium">{r.hoursWorked != null ? `${r.hoursWorked}h` : "—"}</span></td>
                    </tr>
                  ))}
                  {(data.rows ?? []).length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-400">No overtime for this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
