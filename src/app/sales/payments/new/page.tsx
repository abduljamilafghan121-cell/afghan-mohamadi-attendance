"use client";

import { useEffect, useState } from "react";
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

export default function AddCollectionPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "bank_transfer" | "cheque" | "other">("cash");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ shops: Shop[] }>("/api/sales/shops").then((r) => setShops(r.shops)).catch(() => {});
  }, [token]);

  const submit = async () => {
    setError(null);
    setSuccess(null);
    const amt = parseFloat(amount);
    if (!customerName.trim()) return setError("Customer name is required");
    if (!amt || amt <= 0) return setError("Enter a valid amount");
    setBusy(true);
    try {
      await apiFetch("/api/sales/payments", {
        method: "POST",
        body: JSON.stringify({
          customerName: customerName.trim(),
          amount: amt,
          method,
          notes: notes || null,
          shopId: shopId || null,
        }),
      });
      setSuccess("Collection recorded");
      setTimeout(() => router.push("/sales"), 800);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save collection");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-zinc-900">Add Collection</h1>
          <Link href="/sales" className="text-sm text-zinc-600 hover:underline">
            ← Back
          </Link>
        </div>

        <Card>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Customer Name *</label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Linked Shop (optional)</label>
              <Combobox
                options={shops.map((s) => ({ id: s.id, label: s.name }))}
                value={shopId}
                onChange={setShopId}
                placeholder="Search shops…"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Amount *</label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Payment Method</label>
              <select
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm"
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Notes</label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            {success && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

            <Button onClick={submit} disabled={busy} className="w-full">
              {busy ? "Saving…" : "Save Collection"}
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
