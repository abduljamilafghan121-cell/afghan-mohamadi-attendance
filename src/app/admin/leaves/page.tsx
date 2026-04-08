"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/AppShell";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { apiFetch } from "../../../lib/clientApi";
import { getToken, parseJwt } from "../../../lib/clientAuth";

type LeaveRow = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  leaveType: "annual" | "sick" | "casual" | "unpaid";
  status: "pending" | "approved" | "rejected";
  decidedAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string | null };
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
  unpaid: "bg-zinc-100 text-zinc-700",
};

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return d;
  }
}

export default function AdminLeavesPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
    if (user && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("status", status);
      const res = await apiFetch<{ leaves: LeaveRow[] }>(`/api/admin/leaves?${qs.toString()}`);
      setRows(res.leaves);
    } catch (e: any) {
      setError(e?.message ?? "Failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    load();
  }, [token, status]);

  const decide = async (id: string, next: "approved" | "rejected") => {
    setError(null);
    try {
      await apiFetch("/api/admin/leaves", {
        method: "POST",
        body: JSON.stringify({ id, status: next }),
      });
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    }
  };

  return (
    <AppShell>
      <Card title="Leave Requests">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <a className="rounded-lg px-3 py-2 hover:bg-zinc-100" href="/admin/offices">
            Offices
          </a>
          <a className="rounded-lg px-3 py-2 hover:bg-zinc-100" href="/admin/users">
            Users
          </a>
          <a className="rounded-lg px-3 py-2 hover:bg-zinc-100" href="/admin/qr">
            Daily QR
          </a>
          <a className="rounded-lg px-3 py-2 hover:bg-zinc-100" href="/admin/attendance">
            Attendance
          </a>
          <a className="rounded-lg px-3 py-2 hover:bg-zinc-100" href="/admin/org">
            Organization
          </a>
          <a className="rounded-lg bg-zinc-100 px-3 py-2" href="/admin/leaves">
            Leaves
          </a>

          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs text-zinc-500">Status</label>
            <select
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        {error ? <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-600">
                <th className="py-2">Employee</th>
                <th className="py-2">Type</th>
                <th className="py-2">Dates</th>
                <th className="py-2">Reason</th>
                <th className="py-2">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100">
                  <td className="py-3">
                    <div className="font-medium text-zinc-900">{r.user.name}</div>
                    <div className="text-xs text-zinc-500">{r.user.email ?? ""}</div>
                  </td>
                  <td className="py-3">
                    <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${LEAVE_TYPE_COLORS[r.leaveType] ?? "bg-zinc-50 text-zinc-700"}`}>
                      {LEAVE_TYPE_LABELS[r.leaveType] ?? r.leaveType}
                    </span>
                  </td>
                  <td className="py-3 whitespace-nowrap">
                    {fmtDate(r.startDate)} — {fmtDate(r.endDate)}
                  </td>
                  <td className="py-3">{r.reason ?? ""}</td>
                  <td className="py-3">
                    <span className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs">{r.status}</span>
                  </td>
                  <td className="py-3">
                    {r.status === "pending" ? (
                      <div className="flex gap-2">
                        <Button className="h-9 rounded-lg px-3 text-xs" onClick={() => decide(r.id, "approved")}>
                          Approve
                        </Button>
                        <Button className="h-9 rounded-lg px-3 text-xs" variant="danger" onClick={() => decide(r.id, "rejected")}>
                          Reject
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td className="py-6 text-center text-sm text-zinc-500" colSpan={5}>
                    No leave requests.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}
