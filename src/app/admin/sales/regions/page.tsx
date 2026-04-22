"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "../../../../components/AppShell";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { apiFetch } from "../../../../lib/clientApi";
import { getToken, parseJwt } from "../../../../lib/clientAuth";

type Region = {
  id: string;
  name: string;
  isActive: boolean;
  shopCount: number;
};

export default function AdminRegionsPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [regions, setRegions] = useState<Region[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
    else if (user && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  const load = async () => {
    try {
      const r = await apiFetch<{ regions: Region[] }>("/api/admin/sales/regions");
      setRegions(r.regions);
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    }
  };

  useEffect(() => {
    if (token) load();
  }, [token]);

  const create = async () => {
    setError(null);
    if (!name.trim()) return setError("Name required");
    setBusy(true);
    try {
      await apiFetch("/api/admin/sales/regions", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      setName("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (id: string) => {
    const newName = editing[id];
    if (!newName?.trim()) return;
    try {
      await apiFetch("/api/admin/sales/regions", {
        method: "PATCH",
        body: JSON.stringify({ id, name: newName.trim() }),
      });
      setEditing((s) => {
        const c = { ...s };
        delete c[id];
        return c;
      });
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    }
  };

  const toggleActive = async (r: Region) => {
    try {
      await apiFetch("/api/admin/sales/regions", {
        method: "PATCH",
        body: JSON.stringify({ id: r.id, isActive: !r.isActive }),
      });
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    }
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-zinc-900">Regions</h1>
          <Link href="/admin/sales/dashboard" className="text-sm text-zinc-600 hover:underline">
            ← Sales dashboard
          </Link>
        </div>

        <Card title="Add region">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input
              placeholder="e.g. Downtown, North Zone"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button onClick={create} disabled={busy}>
              Add
            </Button>
          </div>
          {error && <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </Card>

        <Card title={`All regions (${regions.length})`}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-zinc-500">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Customers</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {regions.map((r) => {
                  const e = editing[r.id];
                  return (
                    <tr key={r.id}>
                      <td className="py-2 pr-3">
                        {e !== undefined ? (
                          <Input
                            value={e}
                            onChange={(ev) =>
                              setEditing((s) => ({ ...s, [r.id]: ev.target.value }))
                            }
                          />
                        ) : (
                          r.name
                        )}
                      </td>
                      <td className="py-2 pr-3">{r.shopCount}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${
                            r.isActive ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {r.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <div className="flex justify-end gap-1">
                          {e !== undefined ? (
                            <>
                              <Button onClick={() => saveEdit(r.id)} className="h-8 px-3 text-xs">
                                Save
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() =>
                                  setEditing((s) => {
                                    const c = { ...s };
                                    delete c[r.id];
                                    return c;
                                  })
                                }
                                className="h-8 px-3 text-xs"
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="secondary"
                                onClick={() =>
                                  setEditing((s) => ({ ...s, [r.id]: r.name }))
                                }
                                className="h-8 px-3 text-xs"
                              >
                                Edit
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => toggleActive(r)}
                                className="h-8 px-3 text-xs"
                              >
                                {r.isActive ? "Deactivate" : "Activate"}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {regions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-sm text-zinc-500">
                      No regions yet. Add one above to start grouping customers.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Next step">
          <p className="text-sm text-zinc-600">
            Once you have regions, tag each customer with one in{" "}
            <Link href="/admin/sales/customers" className="text-blue-600 hover:underline">
              Customer regions
            </Link>
            , then build weekly visit plans in{" "}
            <Link href="/admin/sales/weekly-plans" className="text-blue-600 hover:underline">
              Weekly Plans
            </Link>
            .
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
