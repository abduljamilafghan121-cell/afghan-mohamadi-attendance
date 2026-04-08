"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/AppShell";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { apiFetch } from "../../../lib/clientApi";
import { getToken, parseJwt } from "../../../lib/clientAuth";

type Office = { id: string; name: string };
type UserOption = { id: string; name: string; email: string | null };
type DayRow = { date: string; userId: string; userName: string; officeName: string; checkInAt: string | null; checkOutAt: string | null; hoursWorked: number | null };
type Summary = { userId: string; userName: string; totalHours: number; byWeek: Record<string, number>; byMonth: Record<string, number> };

function toDateInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function AdminHoursPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const now = new Date();
  const [startDate, setStartDate] = useState(() => toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [endDate, setEndDate] = useState(() => toDateInputValue(now));
  const [offices, setOffices] = useState<Office[]>([]);
  const [officeId, setOfficeId] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userId, setUserId] = useState("");
  const [view, setView] = useState<"days" | "summary">("summary");
  const [days, setDays] = useState<DayRow[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    if (!token) router.push("/login");
    if (user && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiFetch<{ offices: Office[] }>("/api/offices").then((r) => setOffices(r.offices)).catch(() => {}),
      apiFetch<{ users: UserOption[] }>("/api/admin/users").then((r) => setUsers(r.users)).catch(() => {}),
      fetch("/api/org").then((r) => r.json()).then((d) => { if (d?.org?.title) setOrgName(d.org.title); }).catch(() => {}),
    ]);
  }, [token]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ startDate, endDate });
      if (officeId) qs.set("officeId", officeId);
      if (userId) qs.set("userId", userId);
      const res = await apiFetch<{ days: DayRow[]; summaries: Summary[] }>(`/api/admin/hours?${qs}`);
      setDays(res.days);
      setSummaries(res.summaries);
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    load();
  }, [startDate, endDate, officeId, userId, token]);

  const downloadCsv = () => {
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Date", "Employee", "Office", "Check-in", "Check-out", "Hours Worked"];
    const body = days.map((r) => [
      r.date,
      r.userName,
      r.officeName,
      r.checkInAt ? new Date(r.checkInAt).toLocaleString() : "",
      r.checkOutAt ? new Date(r.checkOutAt).toLocaleString() : "",
      r.hoursWorked ?? "",
    ]);
    const csv = [header, ...body].map((row) => row.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `work-hours-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const selectedOfficeName = offices.find((o) => o.id === officeId)?.name ?? "All Offices";
    const selectedUserName = users.find((u) => u.id === userId)?.name ?? "All Employees";
    const totalHours = summaries.reduce((s, r) => s + r.totalHours, 0);

    const filterInfo = [
      `Period: ${startDate} to ${endDate}`,
      officeId ? `Office: ${selectedOfficeName}` : null,
      userId ? `Employee: ${selectedUserName}` : null,
    ].filter(Boolean).join("  |  ");

    const summaryRows = summaries.map((s) => `
      <tr>
        <td>${s.userName}</td>
        <td style="text-align:right;font-family:monospace">${s.totalHours.toFixed(1)}h</td>
        <td style="font-size:10px;color:#666">
          ${Object.entries(s.byMonth).sort().reverse().slice(0, 3).map(([k, v]) => `${k}: ${v.toFixed(1)}h`).join("  ")}
        </td>
      </tr>`).join("");

    const dailyRows = days.map((r) => `
      <tr>
        <td>${r.date}</td>
        <td>${r.userName}</td>
        <td>${r.officeName}</td>
        <td>${r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString() : "-"}</td>
        <td>${r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString() : "-"}</td>
        <td style="text-align:right;font-family:monospace">${r.hoursWorked !== null ? `${r.hoursWorked.toFixed(1)}h` : "-"}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Work Hours Report - ${orgName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 32px; font-size: 12px; }
    .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 20px; }
    .header h1 { font-size: 22px; font-weight: bold; letter-spacing: 1px; }
    .header h2 { font-size: 14px; color: #555; margin-top: 4px; font-weight: normal; }
    .header .filter { font-size: 11px; color: #777; margin-top: 6px; }
    .summary-box { display: inline-block; border: 1px solid #ddd; border-radius: 6px; padding: 10px 20px; text-align: center; margin-bottom: 20px; }
    .summary-box .label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-box .value { font-size: 22px; font-weight: bold; color: #2563eb; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th { background: #f3f4f6; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; text-align: left; border-bottom: 2px solid #ddd; }
    td { padding: 7px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
    tr:nth-child(even) td { background: #fafafa; }
    .total-row td { font-weight: bold; background: #f3f4f6; border-top: 2px solid #ddd; }
    .footer { margin-top: 24px; font-size: 10px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
    .section-title { font-size: 13px; font-weight: bold; margin: 20px 0 8px; color: #333; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${orgName}</h1>
    <h2>Work Hours Report</h2>
    <div class="filter">${filterInfo}</div>
  </div>
  <div class="summary-box">
    <div class="label">Total Hours</div>
    <div class="value">${totalHours.toFixed(1)}h</div>
  </div>

  ${summaries.length > 0 ? `
  <div class="section-title">Summary by Employee</div>
  <table>
    <thead><tr><th>Employee</th><th style="text-align:right">Total Hours</th><th>By Month</th></tr></thead>
    <tbody>
      ${summaryRows}
      <tr class="total-row"><td>Total</td><td style="text-align:right;font-family:monospace">${totalHours.toFixed(1)}h</td><td></td></tr>
    </tbody>
  </table>` : ""}

  ${days.length > 0 ? `
  <div class="section-title">Daily Breakdown</div>
  <table>
    <thead><tr><th>Date</th><th>Employee</th><th>Office</th><th>Check-in</th><th>Check-out</th><th style="text-align:right">Hours</th></tr></thead>
    <tbody>${dailyRows}</tbody>
  </table>` : ""}

  <div class="footer">Generated on ${new Date().toLocaleString()} &nbsp;|&nbsp; ${orgName} Attendance System</div>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  const totalHoursAll = summaries.reduce((s, r) => s + r.totalHours, 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <Card title="Work Hours Report">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36" />
            <span className="text-zinc-400 text-sm">to</span>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36" />
            <select className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm" value={officeId} onChange={(e) => setOfficeId(e.target.value)}>
              <option value="">All Offices</option>
              {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <select className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">All Employees</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <div className="flex rounded-xl border border-zinc-200 overflow-hidden ml-auto">
              <button onClick={() => setView("summary")} className={`px-3 py-2 text-xs ${view === "summary" ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}>Summary</button>
              <button onClick={() => setView("days")} className={`px-3 py-2 text-xs ${view === "days" ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}>Daily</button>
            </div>
            <Button variant="secondary" onClick={downloadCsv} className="h-9 px-3 text-xs">Export CSV</Button>
            <Button variant="secondary" onClick={exportPdf} className="h-9 px-3 text-xs">Export PDF</Button>
          </div>

          {error && <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          {view === "summary" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs text-zinc-600 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Employee</th>
                    <th className="px-4 py-3 text-right">Total Hours</th>
                    <th className="px-4 py-3 text-left">By Month</th>
                    <th className="px-4 py-3 text-left">By Week (last 4)</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((s) => {
                    const monthEntries = Object.entries(s.byMonth).sort().reverse().slice(0, 3);
                    const weekEntries = Object.entries(s.byWeek).sort().reverse().slice(0, 4);
                    return (
                      <tr key={s.userId} className="border-t border-zinc-100 hover:bg-zinc-50">
                        <td className="px-4 py-3 font-medium text-zinc-900">{s.userName}</td>
                        <td className="px-4 py-3 text-right font-mono text-zinc-700">{s.totalHours.toFixed(1)}h</td>
                        <td className="px-4 py-3 text-xs text-zinc-500">
                          {monthEntries.map(([k, v]) => <span key={k} className="mr-2">{k}: {v.toFixed(1)}h</span>)}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">
                          {weekEntries.map(([k, v]) => <span key={k} className="mr-2">{k}: {v.toFixed(1)}h</span>)}
                        </td>
                      </tr>
                    );
                  })}
                  {summaries.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-400">{loading ? "Loading…" : "No data."}</td></tr>
                  )}
                  {summaries.length > 0 && (
                    <tr className="border-t-2 border-zinc-300 bg-zinc-50 font-semibold">
                      <td className="px-4 py-3">Total</td>
                      <td className="px-4 py-3 text-right font-mono">{totalHoursAll.toFixed(1)}h</td>
                      <td colSpan={2} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs text-zinc-600 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Employee</th>
                    <th className="px-4 py-3 text-left">Office</th>
                    <th className="px-4 py-3 text-left">Check-in</th>
                    <th className="px-4 py-3 text-left">Check-out</th>
                    <th className="px-4 py-3 text-right">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((r, i) => (
                    <tr key={i} className="border-t border-zinc-100 hover:bg-zinc-50">
                      <td className="px-4 py-3 text-zinc-500">{r.date}</td>
                      <td className="px-4 py-3 font-medium text-zinc-900">{r.userName}</td>
                      <td className="px-4 py-3 text-zinc-500">{r.officeName}</td>
                      <td className="px-4 py-3 text-zinc-600">{r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString() : "-"}</td>
                      <td className="px-4 py-3 text-zinc-600">{r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString() : "-"}</td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-700">{r.hoursWorked !== null ? `${r.hoursWorked.toFixed(1)}h` : "-"}</td>
                    </tr>
                  ))}
                  {days.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400">{loading ? "Loading…" : "No data."}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
