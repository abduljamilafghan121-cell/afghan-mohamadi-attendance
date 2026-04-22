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

export default function AdminBroadcastPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [audience, setAudience] = useState<"all" | "admin" | "manager" | "employee">("all");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
    else if (user && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  const send = async () => {
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const r = await apiFetch<{ sent: number }>("/api/admin/notifications/broadcast", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim() || null,
          link: link.trim() || null,
          audience,
        }),
      });
      setResult(`Sent to ${r.sent} ${r.sent === 1 ? "user" : "users"}.`);
      setTitle("");
      setBody("");
      setLink("");
    } catch (e: any) {
      setError(e?.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const canSend = title.trim().length > 0 && !sending;

  return (
    <AppShell>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <h1 className="text-xl font-semibold text-zinc-900">Send Announcement</h1>

          <Card title="New broadcast">
            <div className="grid gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Audience</label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as any)}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm focus:ring-4 focus:ring-zinc-100"
                >
                  <option value="all">Everyone</option>
                  <option value="employee">Employees only</option>
                  <option value="manager">Managers only</option>
                  <option value="admin">Admins only</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Title *</label>
                <Input
                  placeholder="e.g. Office closed tomorrow"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Message</label>
                <Textarea
                  rows={4}
                  placeholder="Optional details…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={2000}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Link (optional)</label>
                <Input
                  placeholder="/employee or https://…"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-zinc-500">
                  If set, tapping the notification opens this URL.
                </p>
              </div>

              {error && <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>}
              {result && <div className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{result}</div>}

              <Button onClick={send} disabled={!canSend}>
                {sending ? "Sending…" : "Send notification"}
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Preview">
            <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-base text-indigo-700">
                📣
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-zinc-900">
                  {title.trim() || "Your title here"}
                </div>
                {body.trim() && (
                  <div className="mt-0.5 text-xs text-zinc-600">{body.trim()}</div>
                )}
                <div className="mt-1 text-[10px] uppercase tracking-wide text-zinc-400">
                  just now
                </div>
              </div>
            </div>
          </Card>

          <Card title="What gets notified automatically">
            <ul className="space-y-1 text-xs text-zinc-600">
              <li>📅 Leave request → admins</li>
              <li>✅ Leave decision → employee</li>
              <li>✏️ Correction request → admins</li>
              <li>✏️ Correction decision → employee</li>
              <li>📱 New daily QR → all employees</li>
              <li>⏰ Late check-in → admins</li>
            </ul>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
