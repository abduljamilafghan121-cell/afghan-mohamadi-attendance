"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "../../../../components/AppShell";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { apiFetch } from "../../../../lib/clientApi";
import { getToken, parseJwt } from "../../../../lib/clientAuth";

type Item = {
  id: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};
type Order = {
  id: string;
  total: number;
  paymentType: string;
  status: "pending" | "approved" | "rejected";
  notes: string | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string | null };
  shop: { id: string; name: string };
  items: Item[];
  reviewedBy: { id: string; name: string } | null;
};

const tabs: { key: "pending" | "approved" | "rejected"; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export default function AdminOrdersPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    if (!token) router.push("/login");
    if (user && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch<{ orders: Order[] }>(
        `/api/admin/sales/orders?status=${status}`,
      );
      setOrders(r.orders);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status]);

  const decide = async (id: string, decision: "approved" | "rejected") => {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/api/admin/sales/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: decision,
          reviewNotes: noteFor === id ? noteText || null : null,
        }),
      });
      setNoteFor(null);
      setNoteText("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const fmt = (d: string) => new Date(d).toLocaleString();

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-zinc-900">Order Approvals</h1>
          <Button variant="secondary" onClick={load} disabled={loading} className="h-9 px-3 text-xs">
            {loading ? "Loading…" : "Refresh"}
          </Button>
        </div>

        <div className="flex gap-1 border-b border-zinc-200">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
                status === t.key
                  ? "border-emerald-600 text-emerald-700 font-medium"
                  : "border-transparent text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {orders.length === 0 ? (
          <Card>
            <p className="text-sm text-zinc-500 text-center py-8">
              No {status} orders.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <Card key={o.id}>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-zinc-900">{o.shop.name}</div>
                      <div className="text-xs text-zinc-500">
                        by {o.user.name} • {fmt(o.createdAt)} • {o.paymentType}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">{o.total.toFixed(2)}</div>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                          o.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : o.status === "approved"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {o.status}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-zinc-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                        <tr>
                          <th className="px-2 py-2 font-medium">Product</th>
                          <th className="px-2 py-2 font-medium">Qty</th>
                          <th className="px-2 py-2 text-right font-medium">Unit</th>
                          <th className="px-2 py-2 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {o.items.map((it) => (
                          <tr key={it.id}>
                            <td className="px-2 py-1.5">{it.productName}</td>
                            <td className="px-2 py-1.5">{it.quantity}</td>
                            <td className="px-2 py-1.5 text-right">{it.unitPrice.toFixed(2)}</td>
                            <td className="px-2 py-1.5 text-right">{it.lineTotal.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {o.notes && (
                    <p className="text-xs text-zinc-600">
                      <span className="font-medium">Notes:</span> {o.notes}
                    </p>
                  )}

                  {o.status !== "pending" && (
                    <p className="text-xs text-zinc-500">
                      {o.status} by {o.reviewedBy?.name ?? "—"}
                      {o.reviewedAt ? ` on ${fmt(o.reviewedAt)}` : ""}
                      {o.reviewNotes ? ` • "${o.reviewNotes}"` : ""}
                    </p>
                  )}

                  {o.status === "pending" && (
                    <div className="space-y-2">
                      {noteFor === o.id && (
                        <input
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                          placeholder="Optional note (e.g. reason for rejection)…"
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                        />
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => decide(o.id, "approved")}
                          disabled={busyId === o.id}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => decide(o.id, "rejected")}
                          disabled={busyId === o.id}
                        >
                          Reject
                        </Button>
                        <button
                          type="button"
                          onClick={() => {
                            if (noteFor === o.id) {
                              setNoteFor(null);
                              setNoteText("");
                            } else {
                              setNoteFor(o.id);
                              setNoteText("");
                            }
                          }}
                          className="text-xs text-zinc-600 underline"
                        >
                          {noteFor === o.id ? "Hide note" : "Add note"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="text-center">
          <Link href="/admin/sales/dashboard" className="text-xs text-zinc-500 hover:underline">
            ← Back to Sales Dashboard
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
