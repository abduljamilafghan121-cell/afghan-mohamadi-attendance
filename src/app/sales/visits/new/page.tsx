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

export default function AddVisitPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const presetShopId = sp.get("shopId") ?? "";
  const presetPlanId = sp.get("planId") ?? "";
  const token = typeof window !== "undefined" ? getToken() : null;

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
    if (!token) router.push("/login");
  }, [token, router]);

  const loadShops = async () => {
    try {
      const res = await apiFetch<{ shops: Shop[] }>("/api/sales/shops");
      setShops(res.shops);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load customers");
    }
  };

  useEffect(() => {
    if (!token) return;
    loadShops();
    apiFetch<{ products: Product[] }>("/api/sales/products")
      .then((r) => setProducts(r.products))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (presetShopId) setShopId(presetShopId);
  }, [presetShopId]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

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
    setProductLines((arr) => [...arr, { productId: "", offeredPrice: "", discussion: "", interest: "" }]);
  const updateProductLine = (i: number, patch: Partial<ProductLine>) =>
    setProductLines((arr) => arr.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
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
      setTimeout(() => router.push(presetPlanId ? "/sales/plan" : "/sales"), 800);
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
    [shops],
  );
  const productOptions = useMemo(
    () => products.map((p) => ({ id: p.id, label: p.name, hint: p.price.toFixed(2) })),
    [products],
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-zinc-900">Add Visit</h1>
          <Link href={presetPlanId ? "/sales/plan" : "/sales"} className="text-sm text-zinc-600 hover:underline">
            ← Back
          </Link>
        </div>
        {presetPlanId && (
          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
            Logging visit for a planned customer. The plan will be marked done after you save.
          </div>
        )}

        <Card>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Customer *</label>
              {!showNewShop ? (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Combobox
                      options={shopOptions}
                      value={shopId}
                      onChange={setShopId}
                      placeholder="Search customers…"
                    />
                  </div>
                  <Button variant="secondary" type="button" onClick={() => setShowNewShop(true)}>
                    + New
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <Input
                    placeholder="Customer name *"
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
                      Save customer
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
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-700">
                  Products discussed / offered
                </label>
                <button
                  type="button"
                  onClick={addProductLine}
                  className="text-xs text-zinc-600 underline"
                >
                  + Add product
                </button>
              </div>
              {productLines.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  Optional. Record which products you pitched on this visit.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-2 py-2 font-medium">Product</th>
                        <th className="px-2 py-2 font-medium">Offered price</th>
                        <th className="px-2 py-2 font-medium">Interest</th>
                        <th className="px-2 py-2 font-medium">Discussion</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {productLines.map((l, i) => {
                        const p = productMap.get(l.productId);
                        return (
                          <tr key={i} className="align-top">
                            <td className="px-2 py-2 min-w-[180px]">
                              <Combobox
                                options={productOptions}
                                value={l.productId}
                                onChange={(id) => updateProductLine(i, { productId: id })}
                                placeholder="Search products…"
                              />
                              {p && (
                                <p className="mt-1 text-[11px] text-zinc-500">
                                  List: {p.price.toFixed(2)}
                                </p>
                              )}
                            </td>
                            <td className="px-2 py-2 min-w-[110px]">
                              <Input
                                type="number"
                                step="0.01"
                                min={0}
                                placeholder={p ? p.price.toFixed(2) : "0.00"}
                                value={l.offeredPrice}
                                onChange={(e) =>
                                  updateProductLine(i, { offeredPrice: e.target.value })
                                }
                              />
                            </td>
                            <td className="px-2 py-2 min-w-[130px]">
                              <Input
                                placeholder="High / Medium / Low"
                                value={l.interest}
                                onChange={(e) =>
                                  updateProductLine(i, { interest: e.target.value })
                                }
                              />
                            </td>
                            <td className="px-2 py-2 min-w-[200px]">
                              <Textarea
                                rows={2}
                                placeholder="What was discussed…"
                                value={l.discussion}
                                onChange={(e) =>
                                  updateProductLine(i, { discussion: e.target.value })
                                }
                              />
                            </td>
                            <td className="px-2 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeProductLine(i)}
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
              )}
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
