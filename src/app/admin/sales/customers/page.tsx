"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "../../../../components/AppShell";
import { Card } from "../../../../components/ui/Card";
import { Input } from "../../../../components/ui/Input";
import { Button } from "../../../../components/ui/Button";
import { apiFetch } from "../../../../lib/clientApi";
import { getToken, parseJwt } from "../../../../lib/clientAuth";

type Region = { id: string; name: string };
type Shop = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  regionId: string | null;
  region: { id: string; name: string } | null;
};

type EditDraft = {
  name: string;
  phone: string;
  address: string;
  regionId: string;
  isActive: boolean;
};

export default function AdminCustomersPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [shops, setShops] = useState<Shop[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
    else if (user && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (filter) params.set("regionId", filter);
      if (includeInactive) params.set("includeInactive", "1");
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
  }, [token, q, filter, includeInactive]);

  const startEdit = (s: Shop) => {
    setEditingId(s.id);
    setDraft({
      name: s.name,
      phone: s.phone ?? "",
      address: s.address ?? "",
      regionId: s.regionId ?? "",
      isActive: s.isActive,
    });
    setError(null);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

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

  const saveEdit = async () => {
    if (!editingId || !draft) return;
    if (!draft.name.trim()) {
      setError("Customer name is required.");
      return;
    }
    setBusyId(editingId);
    setError(null);
    try {
      const r = await apiFetch<{ shop: Shop }>("/api/admin/sales/shops", {
        method: "PATCH",
        body: JSON.stringify({
          id: editingId,
          name: draft.name.trim(),
          phone: draft.phone.trim() || null,
          address: draft.address.trim() || null,
          regionId: draft.regionId || null,
          isActive: draft.isActive,
        }),
      });
      setShops((arr) => arr.map((s) => (s.id === editingId ? r.shop : s)));
      cancelEdit();
    } catch (e: any) {
      setError(e?.message ?? "Failed to save");
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (s: Shop) => {
    const next = !s.isActive;
    if (!next && !confirm(`Deactivate "${s.name}"? They will be hidden from salesmen but their history is kept.`))
      return;
    setBusyId(s.id);
    try {
      const r = await apiFetch<{ shop: Shop }>("/api/admin/sales/shops", {
        method: "PATCH",
        body: JSON.stringify({ id: s.id, isActive: next }),
      });
      setShops((arr) => arr.map((x) => (x.id === s.id ? r.shop : x)));
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Customers</h1>
            <p className="text-xs text-zinc-500">Edit, assign regions, or deactivate any customer.</p>
          </div>
          <Link href="/admin/sales/regions" className="text-sm text-zinc-600 hover:underline">
            Manage regions →
          </Link>
        </div>

        <Card>
          <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto]">
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
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              Show inactive
            </label>
          </div>
          {error && <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </Card>

        <Card title={`Customers (${shops.length})`}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-zinc-500">
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Phone</th>
                  <th className="py-2 pr-3">Address</th>
                  <th className="py-2 pr-3">Region</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {shops.map((s) => {
                  const isEditing = editingId === s.id && draft;
                  if (isEditing && draft) {
                    return (
                      <tr key={s.id} className="bg-blue-50/40">
                        <td className="py-2 pr-3">
                          <Input
                            value={draft.name}
                            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                            className="h-9"
                            placeholder="Customer name"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <Input
                            value={draft.phone}
                            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                            className="h-9"
                            placeholder="Phone"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <Input
                            value={draft.address}
                            onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                            className="h-9"
                            placeholder="Address"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <select
                            value={draft.regionId}
                            onChange={(e) => setDraft({ ...draft, regionId: e.target.value })}
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
                        <td className="py-2 pr-3">
                          <label className="flex items-center gap-1.5 text-xs text-zinc-700">
                            <input
                              type="checkbox"
                              checked={draft.isActive}
                              onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                              className="h-4 w-4 rounded border-zinc-300"
                            />
                            Active
                          </label>
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <div className="inline-flex gap-1.5">
                            <Button
                              type="button"
                              onClick={saveEdit}
                              disabled={busyId === s.id}
                              className="h-8 px-3 text-xs"
                            >
                              {busyId === s.id ? "Saving…" : "Save"}
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={cancelEdit}
                              className="h-8 px-3 text-xs"
                            >
                              Cancel
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={s.id} className={s.isActive ? "" : "bg-zinc-50/60 text-zinc-500"}>
                      <td className="py-2 pr-3 font-medium text-zinc-900">{s.name}</td>
                      <td className="py-2 pr-3 text-zinc-600">{s.phone ?? "—"}</td>
                      <td className="py-2 pr-3 text-zinc-600">{s.address ?? "—"}</td>
                      <td className="py-2 pr-3">
                        <select
                          value={s.regionId ?? ""}
                          onChange={(e) => updateRegion(s.id, e.target.value)}
                          disabled={!s.isActive}
                          className="h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm disabled:bg-zinc-100"
                        >
                          <option value="">— None —</option>
                          {regions.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        {s.isActive ? (
                          <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                            Active
                          </span>
                        ) : (
                          <span className="inline-block rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-600">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEdit(s)}
                            className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={busyId === s.id}
                            onClick={() => toggleActive(s)}
                            className={`rounded-lg border px-2.5 py-1 text-xs ${
                              s.isActive
                                ? "border-red-200 text-red-700 hover:bg-red-50"
                                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            {s.isActive ? "Deactivate" : "Reactivate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {shops.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-zinc-500">
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
