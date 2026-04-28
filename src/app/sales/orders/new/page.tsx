"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "../../../../components/AppShell";
import { WorkdayBanner } from "../../../../components/WorkdayBanner";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { Textarea } from "../../../../components/ui/Textarea";
import { Combobox } from "../../../../components/ui/Combobox";
import { apiFetch } from "../../../../lib/clientApi";
import { getToken } from "../../../../lib/clientAuth";

type Shop = { id: string; name: string };
type Product = { id: string; name: string; price: number };
// `unitPrice` is the offered/agreed price for this line. When the user
// hasn't touched it, we keep it in sync with the product's catalogue price.
type Line = { productId: string; quantity: number; unitPrice: number | null };

export default function NewOrderPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;

  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [shopId, setShopId] = useState("");
  const [paymentType, setPaymentType] = useState<"cash" | "credit">("cash");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { productId: "", quantity: 1, unitPrice: null },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ shops: Shop[] }>("/api/sales/shops").then((r) => setShops(r.shops)).catch(() => {});
    apiFetch<{ products: Product[] }>("/api/sales/products")
      .then((r) => setProducts(r.products))
      .catch(() => {});
  }, [token]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // Effective unit price for a line: explicit override OR product catalogue price.
  const effectivePrice = (l: Line): number => {
    if (l.unitPrice != null) return l.unitPrice;
    const p = productMap.get(l.productId);
    return p ? p.price : 0;
  };

  const total = useMemo(() => {
    return lines.reduce((sum, l) => sum + effectivePrice(l) * (l.quantity || 0), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, productMap]);

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setLines((arr) => arr.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };
  // When the product changes we reset any custom price back to the catalogue
  // price for that product (so the user explicitly opts-in to overriding).
  const updateLineProduct = (idx: number, productId: string) =>
    setLines((arr) =>
      arr.map((l, i) => (i === idx ? { ...l, productId, unitPrice: null } : l)),
    );
  const addLine = () =>
    setLines((arr) => [...arr, { productId: "", quantity: 1, unitPrice: null }]);
  const removeLine = (idx: number) => setLines((arr) => arr.filter((_, i) => i !== idx));

  const submit = async () => {
    setError(null);
    setSuccess(null);
    if (!shopId) {
      setError("Please select a customer before submitting");
      return;
    }
    const validLines = lines.filter((l) => l.productId && l.quantity > 0);
    if (validLines.length === 0) {
      setError("Add at least one product line with quantity");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/sales/orders", {
        method: "POST",
        body: JSON.stringify({
          shopId,
          paymentType,
          notes: notes || null,
          items: validLines.map((l) => ({
            productId: l.productId,
            quantity: Number(l.quantity),
            // Only send unitPrice if the user explicitly overrode it.
            ...(l.unitPrice != null ? { unitPrice: Number(l.unitPrice) } : {}),
          })),
        }),
      });
      setSuccess("Order submitted — pending admin approval");
      setTimeout(() => router.push("/sales"), 800);
    } catch (e: any) {
      setError(e?.message ?? "Failed to place order");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-zinc-900">New Order</h1>
          <Link href="/sales" className="text-sm text-zinc-600 hover:underline">
            ← Back
          </Link>
        </div>

        <WorkdayBanner />

        <Card>
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              Orders are submitted for admin approval. They are not finalized until an admin approves them.
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Customer *</label>
              <Combobox
                options={shops.map((s) => ({ id: s.id, label: s.name }))}
                value={shopId}
                onChange={setShopId}
                placeholder="Search customers…"
              />
              {shops.length === 0 && (
                <p className="mt-1 text-xs text-zinc-500">
                  No customers yet. <Link href="/sales/visits/new" className="underline">Add one via Add Visit</Link>.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Items</label>

              {/* Mobile (portrait) — stacked card per line so every field is visible. */}
              <div className="space-y-3 sm:hidden">
                {lines.map((l, i) => {
                  const p = productMap.get(l.productId);
                  const price = effectivePrice(l);
                  const lineTotal = price * (l.quantity || 0);
                  const overridden = l.unitPrice != null && p != null && l.unitPrice !== p.price;
                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-zinc-200 bg-white p-3 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Item {i + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeLine(i)}
                          className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                          aria-label="Remove item"
                        >
                          ✕ Remove
                        </button>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">Product</label>
                        <Combobox
                          options={products.map((pp) => ({
                            id: pp.id,
                            label: pp.name,
                            hint: pp.price.toFixed(2),
                          }))}
                          value={l.productId}
                          onChange={(id) => updateLineProduct(i, id)}
                          placeholder="Search products…"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-zinc-600">Qty</label>
                          <Input
                            type="number"
                            min={1}
                            className="h-10 w-full"
                            value={l.quantity}
                            onChange={(e) =>
                              updateLine(i, { quantity: parseInt(e.target.value, 10) || 0 })
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-zinc-600">Price</label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            className="h-10 w-full text-right"
                            value={p ? price : ""}
                            disabled={!p}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateLine(i, { unitPrice: v === "" ? 0 : Number(v) });
                            }}
                          />
                          {overridden && p && (
                            <div className="mt-0.5 text-[10px] text-amber-700">
                              List: {p.price.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2">
                        <span className="text-xs text-zinc-600">Line total</span>
                        <span className="text-sm font-semibold text-zinc-900">
                          {lineTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tablet & desktop — original table. */}
              <div className="hidden sm:block overflow-x-auto rounded-xl border border-zinc-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-2 py-2 font-medium">Product</th>
                      <th className="px-2 py-2 font-medium">Qty</th>
                      <th className="px-2 py-2 text-right font-medium">Price</th>
                      <th className="px-2 py-2 text-right font-medium">Total</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {lines.map((l, i) => {
                      const p = productMap.get(l.productId);
                      const price = effectivePrice(l);
                      const lineTotal = price * (l.quantity || 0);
                      const overridden = l.unitPrice != null && p != null && l.unitPrice !== p.price;
                      return (
                        <tr key={i} className="align-middle">
                          <td className="px-2 py-2 min-w-[180px]">
                            <Combobox
                              options={products.map((pp) => ({
                                id: pp.id,
                                label: pp.name,
                                hint: pp.price.toFixed(2),
                              }))}
                              value={l.productId}
                              onChange={(id) => updateLineProduct(i, id)}
                              placeholder="Search products…"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              min={1}
                              className="h-10 w-20"
                              value={l.quantity}
                              onChange={(e) => updateLine(i, { quantity: parseInt(e.target.value, 10) || 0 })}
                            />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className="h-10 w-24 text-right"
                              value={p ? price : ""}
                              disabled={!p}
                              onChange={(e) => {
                                const v = e.target.value;
                                updateLine(i, {
                                  unitPrice: v === "" ? 0 : Number(v),
                                });
                              }}
                            />
                            {overridden && p && (
                              <div className="mt-0.5 text-[10px] text-amber-700">
                                List: {p.price.toFixed(2)}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right font-medium text-zinc-800">
                            {lineTotal.toFixed(2)}
                          </td>
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeLine(i)}
                              className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-2">
                <Button variant="secondary" type="button" onClick={addLine}>
                  + Add item
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-3">
              <span className="text-sm text-zinc-600">Total</span>
              <span className="text-lg font-semibold text-zinc-900">{total.toFixed(2)}</span>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Payment Type</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={paymentType === "cash" ? "primary" : "secondary"}
                  onClick={() => setPaymentType("cash")}
                >
                  Cash
                </Button>
                <Button
                  type="button"
                  variant={paymentType === "credit" ? "primary" : "secondary"}
                  onClick={() => setPaymentType("credit")}
                >
                  Credit
                </Button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Notes</label>
              <Textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>

            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            {success && (
              <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>
            )}

            <Button onClick={submit} disabled={busy} className="w-full">
              {busy ? "Submitting…" : "Place Order"}
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
