"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "../../../../components/AppShell";
import { Card } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { Textarea } from "../../../../components/ui/Textarea";
import { Combobox } from "../../../../components/ui/Combobox";
import { apiFetch } from "../../../../lib/clientApi";
import { getToken } from "../../../../lib/clientAuth";

type Shop = { id: string; name: string; address: string | null; phone: string | null };
type Product = { id: string; name: string; price: number };
type ProductLine = { productId: string; offeredPrice: string; discussion: string; interest: string };

export default function AddVisitClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const presetShopId = sp.get("shopId") ?? "";
  const presetPlanId = sp.get("planId") ?? "";

  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(getToken());
  }, []);

  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [shopId, setShopId] = useState("");
  const [showNewShop, setShowNewShop] = useState(false);
  const [newShopName, setNewShopName] = useState("");
  const [newShopAddress, setNewShopAddress] = useState("");
  const [newShopPhone, setNewShopPhone] = useState("");

  const [customerType, setCustomerType] = useState<"new_customer" | "existing">("existing");
  const [notes, setNotes] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);

  const [productLines, setProductLines] = useState<ProductLine[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    router.prefetch("/login");
  }, [token, router]);

  useEffect(() => {
    if (!token) return;
    loadShops();
    apiFetch<{ products: Product[] }>("/api/sales/products")
      .then((r) => setProducts(r.products))
      .catch(() => {});
  }, [token]);

  const loadShops = async () => {
    try {
      const res = await apiFetch<{ shops: Shop[] }>("/api/sales/shops");
      setShops(res.shops);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load customers");
    }
  };

  useEffect(() => {
    if (presetShopId) setShopId(presetShopId);
  }, [presetShopId]);

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  );

  const captureGps = () => {
    if (!navigator.geolocation) {
      setError("GPS not supported in this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setError(err.message || "Failed to read GPS"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const createShop = async () => {
    if (!newShopName.trim()) {
      setError("Customer name is required");
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
      setError(e?.message ?? "Failed to create customer");
    } finally {
      setBusy(false);
    }
  };

  const addProductLine = () =>
    setProductLines((arr) => [
      ...arr,
      { productId: "", offeredPrice: "", discussion: "", interest: "" },
    ]);

  const updateProductLine = (i: number, patch: Partial<ProductLine>) =>
    setProductLines((arr) =>
      arr.map((l, idx) => (idx === i ? { ...l, ...patch } : l))
    );

  const removeProductLine = (i: number) =>
    setProductLines((arr) => arr.filter((_, idx) => idx !== i));

  const submit = async () => {
    setError(null);
    setSuccess(null);

    if (!shopId) {
      setError("Please select a customer");
      return;
    }

    const validProducts = productLines.filter((p) => p.productId);

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
          products: validProducts.map((p) => ({
            productId: p.productId,
            offeredPrice: p.offeredPrice ? Number(p.offeredPrice) : null,
            discussion: p.discussion || null,
            interest: p.interest || null,
          })),
        }),
      });

      setSuccess("Visit logged successfully");
      setNotes("");
      setProductLines([]);

      setTimeout(() => {
        router.push(presetPlanId ? "/sales/plan" : "/sales");
      }, 800);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save visit");
    } finally {
      setBusy(false);
    }
  };

  const shopOptions = useMemo(
    () =>
      shops.map((s) => ({
        id: s.id,
        label: s.name,
        hint: s.address ?? s.phone ?? undefined,
      })),
    [shops]
  );

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        id: p.id,
        label: p.name,
        hint: p.price.toFixed(2),
      })),
    [products]
  );

  if (!token) return <div className="p-4 text-sm">Redirecting...</div>;

  return (
    <AppShell>
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Add Visit</h1>
          <Link href="/sales" className="text-sm text-zinc-600 hover:underline">
            ← Back
          </Link>
        </div>

        <Card>
          <div className="space-y-4">

            <div>
              <label className="text-sm font-medium">Customer *</label>

              {!showNewShop ? (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Combobox
                      options={shopOptions}
                      value={shopId}
                      onChange={setShopId}
                      placeholder="Search customers..."
                    />
                  </div>
                  <Button type="button" onClick={() => setShowNewShop(true)}>
                    + New
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 border p-3 rounded-lg">
                  <Input
                    placeholder="Customer name"
                    value={newShopName}
                    onChange={(e) => setNewShopName(e.target.value)}
                  />
                  <Input
                    placeholder="Address"
                    value={newShopAddress}
                    onChange={(e) => setNewShopAddress(e.target.value)}
                  />
                  <Input
                    placeholder="Phone"
                    value={newShopPhone}
                    onChange={(e) => setNewShopPhone(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button onClick={createShop} disabled={busy}>
                      Save
                    </Button>
                    <Button variant="secondary" onClick={() => setShowNewShop(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Button variant="secondary" onClick={captureGps}>
                {gps ? "Update GPS" : "Capture GPS"}
              </Button>
              <p className="text-xs text-zinc-500 mt-1">
                {gps ? `${gps.lat}, ${gps.lng}` : "Not captured"}
              </p>
            </div>

            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes..."
            />

            {error && <p className="text-red-600 text-sm">{error}</p>}
            {success && <p className="text-green-600 text-sm">{success}</p>}

            <Button onClick={submit} disabled={busy} className="w-full">
              {busy ? "Saving..." : "Save Visit"}
            </Button>

          </div>
        </Card>
      </div>
    </AppShell>
  );
}
