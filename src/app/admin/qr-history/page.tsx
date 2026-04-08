"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/AppShell";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { apiFetch } from "../../../lib/clientApi";
import { getToken, parseJwt } from "../../../lib/clientAuth";

type Office = { id: string; name: string };
type QrToken = {
  id: string;
  workDate: string;
  purpose: "check_in" | "check_out" | "both";
  validFrom: string;
  validTo: string;
  createdAt: string;
  office: { id: string; name: string };
  createdByAdmin: { id: string; name: string } | null;
  _count: { attendanceEvents: number };
};

const PURPOSE_LABELS: Record<string, string> = { check_in: "Check-in", check_out: "Check-out", both: "Both" };
const PURPOSE_COLORS: Record<string, string> = {
  check_in: "bg-blue-50 text-blue-700",
  check_out: "bg-orange-50 text-orange-700",
  both: "bg-emerald-50 text-emerald-700",
};

function toDateInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function AdminQrHistoryPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const now = new Date();
  const [startDate, setStartDate] = useState(() => toDateInputValue(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)));
  const [endDate, setEndDate] = useState(() => toDateInputValue(now));
  const [offices, setOffices] = useState<Office[]>([]);
  const [officeId, setOfficeId] = useState("");
  const [tokens, setTokens] = useState<QrToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
    if (user && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ offices: Office[] }>("/api/offices").then((r) => setOffices(r.offices)).catch(() => {});
  }, [token]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ startDate, endDate });
      if (officeId) qs.set("officeId", officeId);
      const res = await apiFetch<{ tokens: QrToken[] }>(`/api/admin/qr/history?${qs}`);
      setTokens(res.tokens);
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    load();
  }, [startDate, endDate, officeId, token]);

  return (
    <AppShell>
      <Card title="QR Token History">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36" />
          <span className="text-zinc-400 text-sm">to</span>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36" />
          <select className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm" value={officeId} onChange={(e) => setOfficeId(e.target.value)}>
            <option value="">All Offices</option>
            {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>

        {error && <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-600 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Work Date</th>
                <th className="px-4 py-3 text-left">Office</th>
                <th className="px-4 py-3 text-left">Purpose</th>
                <th className="px-4 py-3 text-left">Valid From</th>
                <th className="px-4 py-3 text-left">Valid To</th>
                <th className="px-4 py-3 text-right">Scans</th>
                <th className="px-4 py-3 text-left">Created By</th>
                <th className="px-4 py-3 text-left">Created At</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-3 text-zinc-500">{new Date(t.workDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-medium text-zinc-900">{t.office.name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-lg px-2 py-1 text-xs font-medium ${PURPOSE_COLORS[t.purpose] ?? "bg-zinc-100"}`}>
                      {PURPOSE_LABELS[t.purpose] ?? t.purpose}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{new Date(t.validFrom).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{new Date(t.validTo).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono">{t._count.attendanceEvents}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{t.createdByAdmin?.name ?? "-"}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{new Date(t.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {tokens.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-400">{loading ? "Loading…" : "No tokens found."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {tokens.length > 0 && <div className="mt-3 text-xs text-zinc-400">{tokens.length} token{tokens.length !== 1 ? "s" : ""}</div>}
      </Card>
    </AppShell>
  );
}
