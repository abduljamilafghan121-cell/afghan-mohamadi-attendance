"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "../../../components/AppShell";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { apiFetch } from "../../../lib/clientApi";
import { getToken } from "../../../lib/clientAuth";

type Row = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  decidedAt: string | null;
  decisionNote: string | null;
  decidedBy: { id: string; name: string } | null;
  createdAt: string;
};

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmt(s: string) {
  return new Date(s).toLocaleDateString();
}
function days(s: string, e: string) {
  return Math.round((new Date(e).getTime() - new Date(s).getTime()) / (86400000)) + 1;
}

const STATUS_STYLE: Record<Row["status"], string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-700",
};

export default function SalesmanOutstationPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const today = ymd(new Date());

  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ startDate: today, endDate: today, reason: "" });

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const load = async () => {
    try {
      const r = await apiFetch<{ rows: Row[] }>("/api/sales/outstation");
      setRows(r.rows);
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    }
  };

  useEffect(() => {
    if (token) load();
  }, [token]);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await apiFetch("/api/sales/outstation", {
        method: "POST",
        body: JSON.stringify({
          startDate: form.startDate,
          endDate: form.endDate,
          reason: form.reason.trim() || null,
        }),
      });
      setForm({ startDate: today, endDate: today, reason: "" });
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    if (!confirm("Cancel this request?")) return;
    try {
      await apiFetch(`/api/sales/outstation?id=${id}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    }
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-zinc-900">Outstation Requests</h1>
          <Link href="/sales" className="text-sm text-zinc-600 hover:underline">
            ← Sales
          </Link>
        </div>

        <Card>
          <p className="text-sm text-zinc-600">
            Submit a request when you'll be travelling for work. Once an admin approves, those days
            won't count as absent in attendance and your visit plans for that period are
            auto-cancelled (so they won't be flagged as missed).
          </p>
        </Card>

        <Card title="New request">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Start date</label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">End date</label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={submit} disabled={busy} className="w-full">
                Submit
              </Button>
            </div>
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-zinc-700">Reason (optional)</label>
              <Input
                placeholder="e.g. Visiting clients in Erbil"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>
          </div>
          {error && <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </Card>

        <Card title={`My requests (${rows.length})`}>
          {rows.length === 0 ? (
            <div className="py-4 text-center text-sm text-zinc-500">No requests yet.</div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-zinc-200 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-zinc-900">
                          {fmt(r.startDate)} – {fmt(r.endDate)}
                        </span>
                        <span className="text-xs text-zinc-500">
                          ({days(r.startDate, r.endDate)} day{days(r.startDate, r.endDate) === 1 ? "" : "s"})
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[r.status]}`}>
                          {r.status}
                        </span>
                      </div>
                      {r.reason && (
                        <div className="mt-1 text-sm text-zinc-600">{r.reason}</div>
                      )}
                      {r.decisionNote && (
                        <div className="mt-1 text-xs text-zinc-500">
                          {r.decidedBy?.name ? `${r.decidedBy.name}: ` : ""}{r.decisionNote}
                        </div>
                      )}
                    </div>
                    {r.status === "pending" && (
                      <Button
                        variant="secondary"
                        onClick={() => cancel(r.id)}
                        className="h-8 px-3 text-xs"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
