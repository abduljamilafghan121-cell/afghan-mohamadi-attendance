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

type Product = {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function AdminProductsPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [editing, setEditing] = useState<Record<string, { name: string; price: string }>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        String(p.price).includes(q) ||
        (p.isActive ? "active" : "inactive").includes(q)
    );
  }, [products, search]);

  useEffect(() => {
    if (!token) router.push("/login");
    if (user && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  const load = async () => {
    try {
      const r = await apiFetch<{ products: Product[] }>("/api/admin/products");
      setProducts(r.products);
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    }
  };

  useEffect(() => {
    if (token) load();
  }, [token]);

  const create = async () => {
    setError(null);
    const p = parseFloat(price);
    if (!name.trim()) return setError("Name required");
    if (isNaN(p) || p < 0) return setError("Valid price required");
    setBusy(true);
    try {
      await apiFetch("/api/admin/products", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), price: p }),
      });
      setName("");
      setPrice("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (p: Product) =>
    setEditing((s) => ({ ...s, [p.id]: { name: p.name, price: String(p.price) } }));
  const cancelEdit = (id: string) =>
    setEditing((s) => {
      const c = { ...s };
      delete c[id];
      return c;
    });
  const saveEdit = async (id: string) => {
    const e = editing[id];
    if (!e) return;
    const p = parseFloat(e.price);
    if (!e.name.trim() || isNaN(p) || p < 0) {
      setError("Invalid product fields");
      return;
    }
    try {
      await apiFetch("/api/admin/products", {
        method: "PATCH",
        body: JSON.stringify({ id, name: e.name.trim(), price: p }),
      });
      cancelEdit(id);
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Failed");
    }
  };

  const toggleActive = async (p: Product) => {
    try {
      await apiFetch("/api/admin/products", {
        method: "PATCH",
        body: JSON.stringify({ id: p.id, isActive: !p.isActive }),
      });
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Failed");
    }
  };

  const remove = async (p: Product) => {
    if (!confirm(`Deactivate "${p.name}"? Existing orders will keep their data.`)) return;
    try {
      await apiFetch(`/api/admin/products?id=${encodeURIComponent(p.id)}`, { method: "DELETE" });
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Failed");
    }
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-zinc-900">Products</h1>
          <Link href="/admin/sales/dashboard" className="text-sm text-zinc-600 hover:underline">
            ← Sales dashboard
          </Link>
        </div>

        <Card title="Add product">
          <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
            <Input placeholder="Product name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              type="number"
              step="0.01"
              placeholder="Price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <Button onClick={create} disabled={busy}>
              Add
            </Button>
          </div>
          {error && <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </Card>

        <Card
          title={
            search.trim()
              ? `Products — ${filtered.length} of ${products.length} result${filtered.length !== 1 ? "s" : ""}`
              : `All products (${products.length})`
          }
        >
          <div className="mb-4">
            <Input
              placeholder="Search by name, price or status…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-zinc-500">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3 text-right">Price</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((p) => {
                  const e = editing[p.id];
                  return (
                    <tr key={p.id}>
                      <td className="py-2 pr-3">
                        {e ? (
                          <Input
                            value={e.name}
                            onChange={(ev) =>
                              setEditing((s) => ({ ...s, [p.id]: { ...e, name: ev.target.value } }))
                            }
                          />
                        ) : (
                          p.name
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {e ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={e.price}
                            onChange={(ev) =>
                              setEditing((s) => ({ ...s, [p.id]: { ...e, price: ev.target.value } }))
                            }
                            className="text-right"
                          />
                        ) : (
                          p.price.toFixed(2)
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${
                            p.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {p.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <div className="flex justify-end gap-1">
                          {e ? (
                            <>
                              <Button onClick={() => saveEdit(p.id)} className="h-8 px-3 text-xs">
                                Save
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => cancelEdit(p.id)}
                                className="h-8 px-3 text-xs"
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="secondary"
                                onClick={() => startEdit(p)}
                                className="h-8 px-3 text-xs"
                              >
                                Edit
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => toggleActive(p)}
                                className="h-8 px-3 text-xs"
                              >
                                {p.isActive ? "Deactivate" : "Activate"}
                              </Button>
                              <Button
                                variant="danger"
                                onClick={() => remove(p)}
                                className="h-8 px-3 text-xs"
                                disabled={!p.isActive}
                              >
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-sm text-zinc-500">
                      {search.trim()
                        ? `No products match "${search}".`
                        : "No products yet."}
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
