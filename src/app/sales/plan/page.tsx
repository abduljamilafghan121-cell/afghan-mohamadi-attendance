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

type Plan = {
  id: string;
  shopId: string;
  plannedDate: string;
  notes: string | null;
  status: "pending" | "done" | "missed" | "cancelled";
  shop: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    region: { name: string } | null;
  };
  visit: { id: string; visitDate: string } | null;
};

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_STYLE: Record<Plan["status"], string> = {
  pending: "bg-amber-50 text-amber-700",
  done: "bg-emerald-50 text-emerald-700",
  missed: "bg-rose-50 text-rose-700",
  cancelled: "bg-zinc-100 text-zinc-600",
};

export default function MyPlanPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const today = ymd(new Date());
  const [date, setDate] = useState(today);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    pending: number;
    done: number;
    missed: number;
    cancelled: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiFetch<{ plans: Plan[]; summary: any }>(`/api/sales/my-plan?date=${date}`);
      setPlans(r.plans);
      setSummary(r.summary);
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, date]);

  const shift = (days: number) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + days);
    setDate(ymd(d));
  };

  const isToday = date === today;

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-zinc-900">My Plan</h1>
          <Link href="/sales" className="text-sm text-zinc-600 hover:underline">
            ← Sales
          </Link>
        </div>

        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => shift(-1)} className="h-9 px-3 text-sm">
              ← Prev
            </Button>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-auto"
            />
            <Button variant="secondary" onClick={() => shift(1)} className="h-9 px-3 text-sm">
              Next →
            </Button>
            {!isToday && (
              <Button
                variant="secondary"
                onClick={() => setDate(today)}
                className="h-9 px-3 text-sm"
              >
                Today
              </Button>
            )}
          </div>

          {summary && (
            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-sm">
              <Stat label="Total" value={summary.total} />
              <Stat label="Pending" value={summary.pending} tone="amber" />
              <Stat label="Done" value={summary.done} tone="emerald" />
              <Stat label="Missed" value={summary.missed} tone="rose" />
            </div>
          )}
        </Card>

        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="space-y-3">
          {loading && <div className="text-sm text-zinc-500">Loading…</div>}
          {!loading && plans.length === 0 && (
            <Card>
              <div className="py-6 text-center text-sm text-zinc-500">
                No visits planned for this day.
              </div>
            </Card>
          )}
          {plans.map((p) => (
            <Card key={p.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-zinc-900">{p.shop.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[p.status]}`}>
                      {p.status}
                    </span>
                    {p.shop.region && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                        {p.shop.region.name}
                      </span>
                    )}
                  </div>
                  {p.shop.address && (
                    <div className="mt-1 text-sm text-zinc-600">{p.shop.address}</div>
                  )}
                  {p.shop.phone && (
                    <div className="text-sm text-zinc-600">{p.shop.phone}</div>
                  )}
                  {p.notes && (
                    <div className="mt-2 rounded-lg bg-zinc-50 p-2 text-sm text-zinc-700">
                      <span className="text-xs font-semibold text-zinc-500">Note: </span>
                      {p.notes}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {p.status === "pending" && isToday && (
                    <Link
                      href={`/sales/visits/new?shopId=${encodeURIComponent(p.shopId)}&planId=${encodeURIComponent(p.id)}`}
                    >
                      <Button className="h-9 px-3 text-sm">Log Visit</Button>
                    </Link>
                  )}
                  {p.status === "done" && p.visit && (
                    <span className="text-xs text-emerald-700">
                      Logged at {new Date(p.visit.visitDate).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "amber" | "emerald" | "rose";
}) {
  const cls =
    tone === "amber"
      ? "bg-amber-50 text-amber-800"
      : tone === "emerald"
        ? "bg-emerald-50 text-emerald-800"
        : tone === "rose"
          ? "bg-rose-50 text-rose-800"
          : "bg-zinc-50 text-zinc-800";
  return (
    <div className={`rounded-xl px-3 py-2 ${cls}`}>
      <div className="text-[11px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}
