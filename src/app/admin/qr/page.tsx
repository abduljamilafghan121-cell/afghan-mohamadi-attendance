"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/AppShell";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";
import { apiFetch } from "../../../lib/clientApi";
import { getToken, parseJwt } from "../../../lib/clientAuth";

type Office = {
  id: string;
  name: string;
};

export default function AdminQrPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [offices, setOffices] = useState<Office[]>([]);
  const [officeId, setOfficeId] = useState<string>("");
  const [purpose, setPurpose] = useState<"both" | "check_in" | "check_out">("both");
  const [validFromIso, setValidFromIso] = useState<string>("");
  const [validToIso, setValidToIso] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);

  const printQr = () => {
    if (!qrDataUrl) return;
    const w = window.open("", "_blank");
    if (!w) return;

    const officeName = offices.find((o) => o.id === officeId)?.name ?? officeId;
    const purposeLabel = purpose === "both" ? "Both" : purpose === "check_in" ? "Check-in" : "Check-out";

    const css = `
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 28px; color: #111; }
      h1 { font-size: 18px; margin: 0 0 10px; }
      .meta { font-size: 12px; color: #444; margin-bottom: 16px; }
      .wrap { display: grid; grid-template-columns: 1fr; gap: 16px; align-items: start; }
      .qr { width: 320px; height: 320px; border: 1px solid #ddd; border-radius: 16px; padding: 12px; display: flex; align-items: center; justify-content: center; }
      .qr img { width: 100%; height: 100%; object-fit: contain; }
      @media print { body { padding: 0; } .qr { border: none; padding: 0; } }
    `;

    const escapeHtml = (s: any) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    w.document.open();
    w.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Daily QR</title>
          <style>${css}</style>
        </head>
        <body>
          <h1>Daily QR</h1>
          <div class="meta">
            Office: ${escapeHtml(officeName)}<br />
            Purpose: ${escapeHtml(purposeLabel)}<br />
            Valid: ${escapeHtml(validFromIso)} → ${escapeHtml(validToIso)}
          </div>
          <div class="wrap">
            <div class="qr">
              <img src="${escapeHtml(qrDataUrl)}" alt="QR" />
            </div>
          </div>
        </body>
      </html>
    `);
    w.document.close();

    const doPrint = () => {
      try {
        w.focus();
        w.print();
      } catch {
        // ignore
      }
    };

    w.onload = () => doPrint();
    setTimeout(doPrint, 300);
  };

  useEffect(() => {
    if (!token) router.push("/login");
    if (user && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  useEffect(() => {
    (async () => {
      const res = await apiFetch<{ offices: Office[] }>("/api/offices");
      setOffices(res.offices);
      if (res.offices.length > 0) setOfficeId(res.offices[0].id);

      const now = new Date();
      const toLocalInput = (d: Date) => {
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };
      const from = new Date(now.getTime() + 1 * 60 * 1000);
      const to = new Date(now.getTime() + 60 * 60 * 1000);
      setValidFromIso(toLocalInput(from));
      setValidToIso(toLocalInput(to));
    })().catch(() => {});
  }, []);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setQrDataUrl(null);
    setQrPayload(null);

    try {
      const toIso = (local: string) => new Date(local).toISOString();
      const res = await apiFetch<{ qrDataUrl: string; qrPayload: string }>("/api/qr/daily", {
        method: "POST",
        body: JSON.stringify({
          officeId,
          purpose,
          validFromIso: toIso(validFromIso),
          validToIso: toIso(validToIso),
        }),
      });
      setQrDataUrl(res.qrDataUrl);
      setQrPayload(res.qrPayload);
    } catch (err: any) {
      setError(err?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Daily QR Generator">
            <div className="grid gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Office</label>
                <select
                  value={officeId}
                  onChange={(e) => setOfficeId(e.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm focus:ring-4 focus:ring-zinc-100"
                >
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Purpose</label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value as any)}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm focus:ring-4 focus:ring-zinc-100"
                >
                  <option value="both">Both (check-in + check-out)</option>
                  <option value="check_in">Check-in only</option>
                  <option value="check_out">Check-out only</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Valid from</label>
                  <Input type="datetime-local" value={validFromIso} onChange={(e) => setValidFromIso(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Valid to</label>
                  <Input type="datetime-local" value={validToIso} onChange={(e) => setValidToIso(e.target.value)} />
                </div>
              </div>

              {error ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

              <Button disabled={loading} onClick={generate}>
                {loading ? "Generating..." : "Generate QR"}
              </Button>
            </div>
          </Card>

          {qrDataUrl ? (
            <Card title="QR Code">
              <div className="flex flex-col items-center gap-4">
                <img src={qrDataUrl} alt="Daily QR" className="h-72 w-72 rounded-xl border border-zinc-200" />
                <Button type="button" variant="secondary" onClick={printQr}>
                  Print QR
                </Button>
                <div className="w-full">
                  <div className="mb-2 text-sm font-medium">QR Payload (for testing)</div>
                  <Textarea readOnly rows={5} value={qrPayload ?? ""} />
                </div>
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card title="How employees use it">
            <div className="space-y-2 text-sm text-zinc-700">
              <div>1) Open Employee page</div>
              <div>2) Get GPS</div>
              <div>3) Scan QR (or paste payload for now)</div>
              <div>4) Check in/out</div>
            </div>
          </Card>

          <Card title="Next">
            <div className="text-sm text-zinc-700">
              Add camera QR scan + manager approval workflow.
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
