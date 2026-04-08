"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/AppShell";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { apiFetch } from "../../../lib/clientApi";
import { getToken, parseJwt } from "../../../lib/clientAuth";

type Org = {
  id: string;
  key: string;
  title: string;
  logoUrl: string | null;
  carryOverEnabled: boolean;
  carryOverMaxDays: number | null;
  updatedAt: string;
};

export default function AdminOrgPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [title, setTitle] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [carryOverEnabled, setCarryOverEnabled] = useState(true);
  const [carryOverMaxDays, setCarryOverMaxDays] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
    if (user && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  const load = async () => {
    const res = await apiFetch<{ org: Org | null }>("/api/admin/org");
    if (res.org) {
      setTitle(res.org.title);
      setLogoUrl(res.org.logoUrl ?? "");
      setCarryOverEnabled(res.org.carryOverEnabled ?? true);
      setCarryOverMaxDays(res.org.carryOverMaxDays != null ? String(res.org.carryOverMaxDays) : "");
    }
  };

  useEffect(() => {
    if (!token) return;
    load().catch(() => {});
  }, [token]);

  const save = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let uploadedUrl = logoUrl.trim();
      if (logoFile) {
        const tokenValue = getToken();
        if (!tokenValue) throw new Error("Unauthorized");
        const form = new FormData();
        form.set("file", logoFile);
        const res = await fetch("/api/admin/upload", {
          method: "POST",
          headers: {
            authorization: `Bearer ${tokenValue}`,
          },
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data && (data.error || data.message)) || "Upload failed");
        uploadedUrl = String(data.url || "");
      }

      await apiFetch("/api/admin/org", {
        method: "POST",
        body: JSON.stringify({
          title,
          logoUrl: uploadedUrl.trim() ? uploadedUrl.trim() : undefined,
          carryOverEnabled,
          carryOverMaxDays: carryOverMaxDays.trim() ? parseInt(carryOverMaxDays) : null,
        }),
      });

      setLogoFile(null);
      setSuccess("Organization updated.");
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Organization">
            <div className="mb-3 flex gap-2 text-sm">
              <a className="rounded-lg px-3 py-2 hover:bg-zinc-100" href="/admin/offices">
                Offices
              </a>
              <a className="rounded-lg px-3 py-2 hover:bg-zinc-100" href="/admin/users">
                Users
              </a>
              <a className="rounded-lg px-3 py-2 hover:bg-zinc-100" href="/admin/qr">
                Daily QR
              </a>
              <a className="rounded-lg px-3 py-2 hover:bg-zinc-100" href="/admin/attendance">
                Attendance
              </a>
              <a className="rounded-lg bg-zinc-100 px-3 py-2" href="/admin/org">
                Organization
              </a>
            </div>

            <div className="grid gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Title</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Company name" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Logo (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
                <div className="mt-2 text-xs text-zinc-500">Or paste a URL below.</div>
                <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="/uploads/... or https://..." />
              </div>

              <div className="border-t border-zinc-100 pt-4">
                <div className="mb-3 text-sm font-medium text-zinc-800">Leave Carry-Over Rules</div>
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="checkbox"
                    id="carryOverEnabled"
                    checked={carryOverEnabled}
                    onChange={(e) => setCarryOverEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  <label htmlFor="carryOverEnabled" className="text-sm text-zinc-700">
                    Enable carry-over of unused leave days to next year
                  </label>
                </div>
                {carryOverEnabled && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">
                      Max carry-over days (leave blank for no limit)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={carryOverMaxDays}
                      onChange={(e) => setCarryOverMaxDays(e.target.value)}
                      placeholder="e.g. 5 (blank = unlimited)"
                    />
                  </div>
                )}
              </div>

              {error ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
              {success ? <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}

              <Button disabled={loading || !title.trim()} onClick={save}>
                {loading ? "Saving..." : "Save"}
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Preview">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                {logoUrl.trim() ? <img src={logoUrl.trim()} alt="Logo" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="text-sm font-medium text-zinc-900">{title.trim() || "-"}</div>
            </div>
            <div className="mt-2 text-xs text-zinc-500">Displayed in the top header for all users.</div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
