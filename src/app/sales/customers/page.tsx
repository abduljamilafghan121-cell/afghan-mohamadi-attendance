"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "../../../components/AppShell";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { apiFetch } from "../../../lib/clientApi";
import { getToken } from "../../../lib/clientAuth";

type Customer = { id: string; name: string; address: string | null; phone: string | null };

export default function CustomersListPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    apiFetch<{ shops: Customer[] }>("/api/sales/shops")
      .then((r) => setCustomers(r.shops))
      .catch(() => setCustomers([]))
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        (c.address ?? "").toLowerCase().includes(s) ||
        (c.phone ?? "").toLowerCase().includes(s),
    );
  }, [customers, q]);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-zinc-900">Customers</h1>
          <Link href="/sales" className="text-sm text-zinc-600 hover:underline">
            ← Back
          </Link>
        </div>

        <Card>
          <Input
            placeholder="Search by name, address or phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </Card>

        <Card title={`${filtered.length} customer${filtered.length === 1 ? "" : "s"}`}>
          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No customers match. <Link href="/sales/visits/new" className="underline">Add one via Add Visit</Link>.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {filtered.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/sales/customers/${c.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-zinc-50"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-zinc-900">{c.name}</div>
                      <div className="truncate text-xs text-zinc-500">
                        {c.address || c.phone || "—"}
                      </div>
                    </div>
                    <span className="text-xs text-zinc-400">View →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
