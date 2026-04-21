"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "../../../../components/AppShell";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { Textarea } from "../../../../components/ui/Textarea";
import { Combobox } from "../../../../components/ui/Combobox";
import { apiFetch } from "../../../../lib/clientApi";
import { getToken } from "../../../../lib/clientAuth";

type Shop = { id: string; name: string };
type Product = { id: string; name: string; price: number };
type Line = { productId: string; quantity: number };

export default function NewOrderPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;

  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [shopId, setShopId] = useState("");
  const [paymentType, setPaymentType] = useState<"cash" | "credit">("cash");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ productId: "", quantity: 1 }]);
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

  const total = useMemo(() => {
    return lines.reduce((sum, l) => {
      const p = productMap.get(l.productId);
      if (!p) return sum;
      return sum + p.price * (l.quantity || 0);
    }, 0);
  }, [lines, productMap]);

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setLines((arr) => arr.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };
  const addLine = () => setLines((arr) => [...arr, { productId: "", quantity: 1 }]);
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
          items: validLines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity) })),
        }),
      });
      setSuccess("Order placed successfully");
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

        <Card>
          <div className="space-y-4">
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
              <div className="space-y-2">
                {lines.map((l, i) => {
                  const p = productMap.get(l.productId);
                  const lineTotal = p ? p.price * (l.quantity || 0) : 0;
                  return (
                    <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 p-2">
                      <div className="min-w-[160px] flex-1">
                        <Combobox
                          options={products.map((pp) => ({
                            id: pp.id,
                            label: pp.name,
                            hint: pp.price.toFixed(2),
                          }))}
                          value={l.productId}
                          onChange={(id) => updateLine(i, { productId: id })}
                          placeholder="Search products…"
                        />
                      </div>
                      <Input
                        type="number"
                        min={1}
                        className="h-10 w-20"
                        value={l.quantity}
                        onChange={(e) => updateLine(i, { quantity: parseInt(e.target.value, 10) || 0 })}
                      />
                      <div className="w-24 text-right text-sm font-medium text-zinc-700">
                        {lineTotal.toFixed(2)}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
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
