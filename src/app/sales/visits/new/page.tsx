"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "../../../../components/AppShell";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { Textarea } from "../../../../components/ui/Textarea";
import { apiFetch } from "../../../../lib/clientApi";
import { getToken } from "../../../../lib/clientAuth";

type Shop = { id: string; name: string; address: string | null; phone: string | null };

export default function AddVisitPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;

  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState("");
  const [showNewShop, setShowNewShop] = useState(false);
  const [newShopName, setNewShopName] = useState("");
  const [newShopAddress, setNewShopAddress] = useState("");
  const [newShopPhone, setNewShopPhone] = useState("");

  const [customerType, setCustomerType] = useState<"new_customer" | "existing">("existing");
  const [notes, setNotes] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const loadShops = async () => {
    try {
      const res = await apiFetch<{ shops: Shop[] }>("/api/sales/shops");
      setShops(res.shops);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load shops");
    }
  };

  useEffect(() => {
    if (token) loadShops();
  }, [token]);

  const captureGps = () => {
    if (!navigator.geolocation) {
      setError("GPS not supported in this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setError(err.message || "Failed to read GPS"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const createShop = async () => {
    if (!newShopName.trim()) {
      setError("Shop name is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ shop: Shop }>("/api/sales/shops", {
        method: "POST",
        body: JSON.stringify({
          name: newShopName.trim(),
          address: newShopAddress || null,
          phone: newShopPhone || null,
          gpsLat: gps?.lat ?? null,
          gpsLng: gps?.lng ?? null,
        }),
      });
      setShops((s) => [res.shop, ...s]);
      setShopId(res.shop.id);
      setShowNewShop(false);
      setNewShopName("");
      setNewShopAddress("");
      setNewShopPhone("");
      setCustomerType("new_customer");
    } catch (e: any) {
      setError(e?.message ?? "Failed to create shop");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setError(null);
    setSuccess(null);
    if (!shopId) {
      setError("Please select a shop");
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/api/sales/visits", {
        method: "POST",
        body: JSON.stringify({
          shopId,
          customerType,
          notes: notes || null,
          gpsLat: gps?.lat ?? null,
          gpsLng: gps?.lng ?? null,
        }),
      });
      setSuccess("Visit logged successfully");
      setNotes("");
      setTimeout(() => router.push("/sales"), 800);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save visit");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-zinc-900">Add Visit</h1>
          <Link href="/sales" className="text-sm text-zinc-600 hover:underline">
            ← Back
          </Link>
        </div>

        <Card>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Shop</label>
              {!showNewShop ? (
                <div className="flex gap-2">
                  <select
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm"
                    value={shopId}
                    onChange={(e) => setShopId(e.target.value)}
                  >
                    <option value="">— Select a shop —</option>
                    {shops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <Button variant="secondary" type="button" onClick={() => setShowNewShop(true)}>
                    + New
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <Input
                    placeholder="Shop name *"
                    value={newShopName}
                    onChange={(e) => setNewShopName(e.target.value)}
                  />
                  <Input
                    placeholder="Address (optional)"
                    value={newShopAddress}
                    onChange={(e) => setNewShopAddress(e.target.value)}
                  />
                  <Input
                    placeholder="Phone (optional)"
                    value={newShopPhone}
                    onChange={(e) => setNewShopPhone(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button onClick={createShop} disabled={busy}>
                      Save shop
                    </Button>
                    <Button variant="secondary" onClick={() => setShowNewShop(false)} type="button">
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Customer type</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={customerType === "existing" ? "primary" : "secondary"}
                  onClick={() => setCustomerType("existing")}
                >
                  Existing
                </Button>
                <Button
                  type="button"
                  variant={customerType === "new_customer" ? "primary" : "secondary"}
                  onClick={() => setCustomerType("new_customer")}
                >
                  New
                </Button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">GPS Location</label>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={captureGps} type="button">
                  {gps ? "Update GPS" : "Capture GPS"}
                </Button>
                <span className="text-xs text-zinc-500">
                  {gps ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : "Not captured"}
                </span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Notes</label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything worth remembering…"
              />
            </div>

            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            {success && (
              <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>
            )}

            <Button onClick={submit} disabled={busy} className="w-full">
              {busy ? "Saving…" : "Save Visit"}
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
