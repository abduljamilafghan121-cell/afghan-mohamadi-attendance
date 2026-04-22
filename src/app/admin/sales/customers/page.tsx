"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "../../../../components/AppShell";
import { Card } from "../../../../components/ui/Card";
import { Input } from "../../../../components/ui/Input";
import { apiFetch } from "../../../../lib/clientApi";
import { getToken, parseJwt } from "../../../../lib/clientAuth";

type Region = { id: string; name: string };
type Shop = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  regionId: string | null;
  region: { id: string; name: string } | null;
};

export default function AdminCustomerRegionsPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [shops, setShops] = useState<Shop[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
    else if (user && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (filter) params.set("regionId", filter);
      const [s, r] = await Promise.all([
        apiFetch<{ shops: Shop[] }>(`/api/admin/sales/shops?${params}`),
        apiFetch<{ regions: Region[] }>("/api/sales/regions"),
      ]);
      setShops(s.shops);
      setRegions(r.regions);
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    }
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, q, filter]);

  const updateRegion = async (shopId: string, regionId: string) => {
    try {
      await apiFetch("/api/admin/sales/shops", {
        method: "PATCH",
        body: JSON.stringify({ id: shopId, regionId: regionId || null }),
      });
      setShops((arr) =>
        arr.map((s) =>
          s.id === shopId
            ? {
                ...s,
                regionId: regionId || null,
                region: regionId ? regions.find((r) => r.id === regionId) ?? null : null,
              }
            : s,
        ),
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    }
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-zinc-900">Customer Regions</h1>
          <Link href="/admin/sales/regions" className="text-sm text-zinc-600 hover:underline">
            Manage regions →
          </Link>
        </div>

        <Card>
          <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <Input
              placeholder="Search customer name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm"
            >
              <option value="">All regions</option>
              <option value="none">— Unassigned —</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          {error && <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </Card>

        <Card title={`Customers (${shops.length})`}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-zinc-500">
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Address</th>
                  <th className="py-2 pr-3">Region</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {shops.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 pr-3 font-medium text-zinc-900">{s.name}</td>
                    <td className="py-2 pr-3 text-zinc-600">{s.address ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <select
                        value={s.regionId ?? ""}
                        onChange={(e) => updateRegion(s.id, e.target.value)}
                        className="h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm"
                      >
                        <option value="">— None —</option>
                        {regions.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {shops.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-sm text-zinc-500">
                      No customers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
