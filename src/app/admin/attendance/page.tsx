"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/AppShell";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { apiFetch } from "../../../lib/clientApi";
import { getToken, parseJwt } from "../../../lib/clientAuth";
import { downloadTextFile, exportHtmlReport } from "../../../lib/exportUtils";

type Office = { id: string; name: string };
type UserOption = { id: string; name: string; email: string | null };

type AttendanceRow = {
  date: string;
  sessionId: string | null;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  present: boolean;
  isLateArrival: boolean;
  isEarlyDeparture: boolean;
  isOvertime: boolean;
  minutesLate: number | null;
  minutesEarlyDeparture: number | null;
  isHoliday: boolean;
  holidayName: string | null;
  isOffDay: boolean;
  hasWorkdayOverride: boolean;
  user: { id: string; name: string; email: string | null; role: string; isActive: boolean };
  office: { id: string; name: string; timezone: string } | null;
};

function toDateInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const STATUS_COLORS: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700",
  open: "bg-emerald-50 text-emerald-700",
  closed: "bg-blue-50 text-blue-700",
  absent: "bg-red-50 text-red-700",
  leave: "bg-yellow-50 text-yellow-700",
  off: "bg-zinc-100 text-zinc-500",
  holiday: "bg-amber-50 text-amber-700",
  overtime: "bg-orange-50 text-orange-700",
  outstation: "bg-sky-50 text-sky-700",
  needs_approval: "bg-orange-50 text-orange-700",
  corrected: "bg-purple-50 text-purple-700",
};

export default function AdminAttendancePage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [startDate, setStartDate] = useState(() => toDateInputValue(new Date()));
  const [endDate, setEndDate] = useState(() => toDateInputValue(new Date()));
  const [offices, setOffices] = useState<Office[]>([]);
  const [officeId, setOfficeId] = useState<string>("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [presence, setPresence] = useState<"all" | "present" | "absent" | "outstation">("all");
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");

  const [correctingSessionId, setCorrectingSessionId] = useState<string | null>(null);
  const [corrCheckIn, setCorrCheckIn] = useState("");
  const [corrCheckOut, setCorrCheckOut] = useState("");
  const [corrNote, setCorrNote] = useState("");
  const [corrLoading, setCorrLoading] = useState(false);
  const [corrError, setCorrError] = useState<string | null>(null);
  const [corrSuccess, setCorrSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
    if (user && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("startDate", startDate);
      qs.set("endDate", endDate);
      if (officeId.trim()) qs.set("officeId", officeId.trim());
      if (userId.trim()) qs.set("userId", userId.trim());
      if (presence !== "all") qs.set("presence", presence);
      const res = await apiFetch<{ rows: AttendanceRow[] }>(`/api/admin/attendance?${qs.toString()}`);
      setRows(res.rows);
    } catch (e: any) {
      setError(e?.message ?? "Failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiFetch<{ offices: Office[] }>("/api/offices").then((r) => setOffices(r.offices)).catch(() => {}),
      apiFetch<{ users: UserOption[] }>("/api/admin/users").then((r) => setUsers(r.users)).catch(() => {}),
      fetch("/api/org").then((r) => r.json()).then((d) => { if (d?.org?.title) setOrgName(d.org.title); }).catch(() => {}),
    ]);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const t = setTimeout(() => load(), 200);
    return () => clearTimeout(t);
  }, [startDate, endDate, officeId, userId, presence, token]);

  const selectedOfficeName = offices.find((o) => o.id === officeId)?.name ?? "All Offices";
  const selectedUserName = users.find((u) => u.id === userId)?.name ?? "All Employees";

  const downloadCsv = async () => {
    try {
      const esc = (v: any) => {
        const s = v === null || v === undefined ? "" : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      };
      const header = ["Date", "Employee", "Email", "Office", "Check-in", "Check-out", "Status"];
      const lines = [header.map(esc).join(",")].concat(
        rows.map((r) =>
          [
            r.date,
            r.user.name,
            r.user.email ?? "",
            r.office?.name ?? "",
            r.checkInAt ? new Date(r.checkInAt).toLocaleString() : "",
            r.checkOutAt ? new Date(r.checkOutAt).toLocaleString() : "",
            r.status,
          ].map(esc).join(",")
        )
      );

      const csv = lines.join("\n");
      await downloadTextFile(`attendance_${startDate}_to_${endDate}.csv`, csv, "text/csv;charset=utf-8");
    } catch (e: any) {
      alert(e?.message ?? "Export failed");
    }
  };

  const exportPdf = async () => {
    try {
      const present = rows.filter((r) => r.present).length;
      const absent = rows.filter((r) => r.status === "absent").length;
      const onLeave = rows.filter((r) => r.status === "leave").length;
      const off = rows.filter((r) => r.status === "off").length;
      const other = rows.length - present - absent - onLeave - off;

    const filterInfo = [
      `Period: ${startDate} to ${endDate}`,
      officeId ? `Office: ${selectedOfficeName}` : null,
      userId ? `Employee: ${selectedUserName}` : null,
      presence !== "all" ? `Filter: ${presence}` : null,
    ].filter(Boolean).join("  |  ");

    const tableRows = rows.map((r) => `
      <tr>
        <td>${r.date}</td>
        <td>${r.user.name}</td>
        <td>${r.user.email ?? ""}</td>
        <td>${r.office?.name ?? "-"}</td>
        <td>${r.checkInAt ? new Date(r.checkInAt).toLocaleString() : "-"}</td>
        <td>${r.checkOutAt ? new Date(r.checkOutAt).toLocaleString() : "-"}</td>
        <td class="status ${r.status}">${r.status.charAt(0).toUpperCase() + r.status.slice(1)}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Attendance Report - ${orgName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 32px; font-size: 12px; }
    .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 20px; }
    .header h1 { font-size: 22px; font-weight: bold; letter-spacing: 1px; }
    .header h2 { font-size: 14px; color: #555; margin-top: 4px; font-weight: normal; }
    .header .filter { font-size: 11px; color: #777; margin-top: 6px; }
    .summary { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .summary-box { border: 1px solid #ddd; border-radius: 6px; padding: 10px 16px; min-width: 100px; text-align: center; }
    .summary-box .label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-box .value { font-size: 20px; font-weight: bold; margin-top: 2px; }
    .present .value { color: #16a34a; }
    .absent .value { color: #dc2626; }
    .leave .value { color: #ca8a04; }
    .off .value { color: #6b7280; }
    .total .value { color: #2563eb; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th { background: #f3f4f6; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; text-align: left; border-bottom: 2px solid #ddd; }
    td { padding: 7px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
    tr:nth-child(even) td { background: #fafafa; }
    .status { font-weight: bold; font-size: 11px; }
    .status.present, .status.open { color: #16a34a; }
    .status.absent { color: #dc2626; }
    .status.leave { color: #ca8a04; }
    .status.closed { color: #2563eb; }
    .status.off { color: #6b7280; }
    .status.needs_approval { color: #ea580c; }
    .status.corrected { color: #7c3aed; }
    .footer { margin-top: 24px; font-size: 10px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
    @media print {
      body { padding: 16px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${orgName}</h1>
    <h2>Attendance Report</h2>
    <div class="filter">${filterInfo}</div>
  </div>
  <div class="summary">
    <div class="summary-box total"><div class="label">Total</div><div class="value">${rows.length}</div></div>
    <div class="summary-box present"><div class="label">Present</div><div class="value">${present}</div></div>
    <div class="summary-box absent"><div class="label">Absent</div><div class="value">${absent}</div></div>
    <div class="summary-box leave"><div class="label">On Leave</div><div class="value">${onLeave}</div></div>
    <div class="summary-box off"><div class="label">Day Off</div><div class="value">${off}</div></div>
    ${other > 0 ? `<div class="summary-box"><div class="label">Other</div><div class="value">${other}</div></div>` : ""}
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Employee</th>
        <th>Email</th>
        <th>Office</th>
        <th>Check-in</th>
        <th>Check-out</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="footer">Generated on ${new Date().toLocaleString()} &nbsp;|&nbsp; ${orgName} Attendance System</div>
</body>
</html>`;

      await exportHtmlReport(`attendance_${startDate}_to_${endDate}`, html);
    } catch (e: any) {
      alert(e?.message ?? "Export failed");
    }
  };

  const startCorrection = (r: AttendanceRow) => {
    if (!r.sessionId) return;
    setCorrectingSessionId(r.sessionId);
    setCorrCheckIn(r.checkInAt ? r.checkInAt.slice(0, 16) : "");
    setCorrCheckOut(r.checkOutAt ? r.checkOutAt.slice(0, 16) : "");
    setCorrNote("");
    setCorrError(null);
    setCorrSuccess(null);
  };

  const submitCorrection = async (sessionId: string) => {
    setCorrLoading(true);
    setCorrError(null);
    try {
      const body: Record<string, any> = { sessionId, note: corrNote };
      if (corrCheckIn) body.checkInAt = new Date(corrCheckIn).toISOString();
      if (corrCheckOut) body.checkOutAt = new Date(corrCheckOut).toISOString();
      await apiFetch("/api/admin/attendance/correct", { method: "POST", body: JSON.stringify(body) });
      setCorrSuccess("Correction saved.");
      setCorrectingSessionId(null);
      await load();
    } catch (e: any) {
      setCorrError(e?.message ?? "Failed");
    } finally {
      setCorrLoading(false);
    }
  };

  const presentCount = rows.filter((r) => r.present).length;
  const absentCount = rows.filter((r) => r.status === "absent").length;
  const leaveCount = rows.filter((r) => r.status === "leave").length;

  return (
    <AppShell>
      <Card title="Attendance">
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <a className="rounded-lg px-3 py-2 hover:bg-zinc-100" href="/admin/offices">Offices</a>
          <a className="rounded-lg px-3 py-2 hover:bg-zinc-100" href="/admin/users">Users</a>
          <a className="rounded-lg px-3 py-2 hover:bg-zinc-100" href="/admin/qr">Daily QR</a>
          <a className="rounded-lg bg-zinc-100 px-3 py-2 font-medium" href="/admin/attendance">Attendance</a>
          <a className="rounded-lg px-3 py-2 hover:bg-zinc-100" href="/admin/leaves">Leaves</a>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">Start Date</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">End Date</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">Office</label>
            <select
              value={officeId}
              onChange={(e) => setOfficeId(e.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm focus:ring-4 focus:ring-zinc-100"
            >
              <option value="">All Offices</option>
              {offices.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">Employee</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm focus:ring-4 focus:ring-zinc-100"
            >
              <option value="">All Employees</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">Status</label>
            <select
              value={presence}
              onChange={(e) => setPresence(e.target.value as any)}
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm focus:ring-4 focus:ring-zinc-100"
            >
              <option value="all">All</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="outstation">Outstation</option>
            </select>
          </div>
          <div className="flex flex-col justify-end gap-1">
            <Button type="button" variant="secondary" onClick={downloadCsv} className="w-full text-xs">
              Export CSV
            </Button>
            <Button type="button" onClick={exportPdf} className="w-full text-xs">
              Export PDF
            </Button>
          </div>
        </div>

        {rows.length > 0 && (
          <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
            <div className="rounded-xl border border-zinc-200 p-3 text-center">
              <div className="text-xs text-zinc-400 uppercase tracking-wide">Total</div>
              <div className="text-xl font-bold text-blue-600">{rows.length}</div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
              <div className="text-xs text-emerald-600 uppercase tracking-wide">Present</div>
              <div className="text-xl font-bold text-emerald-700">{presentCount}</div>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center">
              <div className="text-xs text-red-600 uppercase tracking-wide">Absent</div>
              <div className="text-xl font-bold text-red-700">{absentCount}</div>
            </div>
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-center">
              <div className="text-xs text-yellow-600 uppercase tracking-wide">On Leave</div>
              <div className="text-xl font-bold text-yellow-700">{leaveCount}</div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-center">
              <div className="text-xs text-zinc-400 uppercase tracking-wide">Other</div>
              <div className="text-xl font-bold text-zinc-500">{rows.length - presentCount - absentCount - leaveCount}</div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="min-w-full text-left text-sm">
            {corrSuccess && (
              <div className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{corrSuccess}</div>
            )}
            <thead className="bg-zinc-50 text-xs font-medium text-zinc-600 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3 hidden sm:table-cell">Office</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 hidden md:table-cell">Check-in</th>
                <th className="px-4 py-3 hidden md:table-cell">Check-out</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <Fragment key={`${r.user.id}-${r.date}-${i}`}>
                  <tr className="border-t border-zinc-100 hover:bg-zinc-50">
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{r.date}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900">{r.user.name}</div>
                      <div className="text-xs text-zinc-400">{r.user.email ?? ""}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 hidden sm:table-cell">{r.office?.name ?? "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <span className={`rounded-lg px-2 py-1 text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-zinc-100 text-zinc-600"}`}>
                          {r.status}{r.holidayName && r.status === "holiday" ? `: ${r.holidayName}` : ""}
                        </span>
                        {r.isLateArrival && (
                          <span className="rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                            Late{r.minutesLate ? ` +${r.minutesLate}m` : ""}
                          </span>
                        )}
                        {r.isEarlyDeparture && (
                          <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                            Early out{r.minutesEarlyDeparture ? ` -${r.minutesEarlyDeparture}m` : ""}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 hidden md:table-cell whitespace-nowrap">
                      {r.checkInAt ? new Date(r.checkInAt).toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 hidden md:table-cell whitespace-nowrap">
                      {r.checkOutAt ? new Date(r.checkOutAt).toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {r.sessionId && correctingSessionId !== r.sessionId && (
                        <button
                          onClick={() => startCorrection(r)}
                          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs hover:bg-zinc-50"
                        >
                          Correct
                        </button>
                      )}
                    </td>
                  </tr>
                  {r.sessionId && correctingSessionId === r.sessionId && (
                    <tr className="border-t border-blue-100 bg-blue-50">
                      <td colSpan={7} className="px-4 py-4">
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-blue-700 mb-2">
                            Correcting attendance for {r.user.name} on {r.date}
                          </div>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <div>
                              <label className="mb-1 block text-xs text-zinc-600">Check-in time</label>
                              <Input type="datetime-local" value={corrCheckIn} onChange={(e) => setCorrCheckIn(e.target.value)} />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-zinc-600">Check-out time</label>
                              <Input type="datetime-local" value={corrCheckOut} onChange={(e) => setCorrCheckOut(e.target.value)} />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-zinc-600">Note (reason)</label>
                              <Input value={corrNote} onChange={(e) => setCorrNote(e.target.value)} placeholder="Admin correction note" />
                            </div>
                          </div>
                          {corrError && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{corrError}</div>}
                          <div className="flex gap-2">
                            <Button onClick={() => submitCorrection(r.sessionId!)} disabled={corrLoading} className="h-9 px-3 text-xs">
                              {corrLoading ? "Saving…" : "Save Correction"}
                            </Button>
                            <Button variant="secondary" onClick={() => { setCorrectingSessionId(null); setCorrError(null); }} className="h-9 px-3 text-xs">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-zinc-400" colSpan={7}>
                    {loading ? "Loading..." : "No records for the selected filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {rows.length > 0 && (
          <div className="mt-3 text-xs text-zinc-400">{rows.length} record{rows.length !== 1 ? "s" : ""}</div>
        )}
      </Card>
    </AppShell>
  );
}
