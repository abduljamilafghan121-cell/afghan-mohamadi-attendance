"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/AppShell";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { apiFetch } from "../../../lib/clientApi";
import { getToken, parseJwt } from "../../../lib/clientAuth";

type CorrReq = {
  id: string;
  workDate: string;
  requestType: "check_in" | "check_out" | "both";
  intendedCheckIn: string | null;
  intendedCheckOut: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  decidedAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string | null };
  session: { id: string; checkInAt: string | null; checkOutAt: string | null; status: string } | null;
};

const TYPE_LABELS: Record<string, string> = { check_in: "Check-in", check_out: "Check-out", both: "Both" };
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
};

export default function AdminCorrectionsPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [rows, setRows] = useState<CorrReq[]>([]);
  const [loading, setLoading] = useState(false);
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
      const res = await apiFetch<{ requests: CorrReq[] }>(`/api/admin/corrections?status=${statusFilter}`);
      setRows(res.requests);
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    load();
  }, [token, statusFilter]);

  const decide = async (id: string, status: "approved" | "rejected") => {
    setDeciding(id);
    setError(null);
    try {
      await apiFetch("/api/admin/corrections", { method: "POST", body: JSON.stringify({ id, status }) });
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setDeciding(null);
    }
  };

  return (
    <AppShell>
      <Card title="Correction Requests">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500">Status</label>
            <select
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        {error && <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="space-y-4">
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-400">{loading ? "Loading…" : "No correction requests."}</p>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="rounded-xl border border-zinc-200 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-zinc-900">{r.user.name}</span>
                      <span className="text-xs text-zinc-400">{r.user.email}</span>
                      <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status]}`}>{r.status}</span>
                      <span className="rounded-lg border border-zinc-200 px-2 py-0.5 text-xs">{TYPE_LABELS[r.requestType]}</span>
                    </div>
                    <div className="mt-2 text-sm text-zinc-600">
                      <span className="font-medium">Date:</span> {new Date(r.workDate).toLocaleDateString()}
                    </div>
                    {(r.requestType === "check_in" || r.requestType === "both") && (
                      <div className="text-sm text-zinc-600">
                        <span className="font-medium">Intended Check-in:</span>{" "}
                        {r.intendedCheckIn ? new Date(r.intendedCheckIn).toLocaleString() : "-"}
                      </div>
                    )}
                    {(r.requestType === "check_out" || r.requestType === "both") && (
                      <div className="text-sm text-zinc-600">
                        <span className="font-medium">Intended Check-out:</span>{" "}
                        {r.intendedCheckOut ? new Date(r.intendedCheckOut).toLocaleString() : "-"}
                      </div>
                    )}
                    {r.session && (
                      <div className="mt-2 text-xs text-zinc-400">
                        Current session — in: {r.session.checkInAt ? new Date(r.session.checkInAt).toLocaleString() : "none"} / out:{" "}
                        {r.session.checkOutAt ? new Date(r.session.checkOutAt).toLocaleString() : "none"} [{r.session.status}]
                      </div>
                    )}
                    <div className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm italic text-zinc-600">{r.reason}</div>
                    <div className="mt-1 text-xs text-zinc-400">Submitted {new Date(r.createdAt).toLocaleString()}</div>
                  </div>
                  {r.status === "pending" && (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        onClick={() => decide(r.id, "approved")}
                        disabled={deciding === r.id}
                        className="h-9 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => decide(r.id, "rejected")}
                        disabled={deciding === r.id}
                        className="h-9 px-3 text-xs"
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                  {r.status !== "pending" && r.decidedAt && (
                    <div className="text-xs text-zinc-400">{r.status} on {new Date(r.decidedAt).toLocaleDateString()}</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </AppShell>
  );
}
