"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "../../components/AppShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { apiFetch } from "../../lib/clientApi";
import { getToken } from "../../lib/clientAuth";

type NotifType =
  | "leave_submitted"
  | "leave_decided"
  | "correction_submitted"
  | "correction_decided"
  | "qr_generated"
  | "late_check_in"
  | "broadcast"
  | "system";

type Notif = {
  id: string;
  type: NotifType;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

const META: Record<NotifType, { icon: string; color: string; label: string }> = {
  leave_submitted:      { icon: "📅", color: "bg-blue-100 text-blue-700",     label: "Leave" },
  leave_decided:        { icon: "✅", color: "bg-emerald-100 text-emerald-700", label: "Leave" },
  correction_submitted: { icon: "✏️", color: "bg-amber-100 text-amber-700",   label: "Correction" },
  correction_decided:   { icon: "✏️", color: "bg-emerald-100 text-emerald-700", label: "Correction" },
  qr_generated:         { icon: "📱", color: "bg-violet-100 text-violet-700", label: "QR" },
  late_check_in:        { icon: "⏰", color: "bg-rose-100 text-rose-700",     label: "Late" },
  broadcast:            { icon: "📣", color: "bg-indigo-100 text-indigo-700", label: "Announcement" },
  system:               { icon: "🔔", color: "bg-zinc-100 text-zinc-700",     label: "System" },
};

export default function NotificationsPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const [items, setItems] = useState<Notif[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiFetch<{ items: Notif[] }>(
        `/api/notifications?limit=200${filter === "unread" ? "&unread=1" : ""}`,
      );
      setItems(r.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filter]);

  const markAll = async () => {
    await apiFetch("/api/notifications/read", {
      method: "POST",
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
    load();
  };

  const markOne = async (id: string) => {
    await apiFetch("/api/notifications/read", {
      method: "POST",
      body: JSON.stringify({ id }),
    }).catch(() => {});
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-zinc-900">Notifications</h1>
          <div className="flex items-center gap-2">
            <Button
              variant={filter === "all" ? "primary" : "secondary"}
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              variant={filter === "unread" ? "primary" : "secondary"}
              onClick={() => setFilter("unread")}
            >
              Unread
            </Button>
            <Button variant="secondary" onClick={markAll}>
              Mark all read
            </Button>
          </div>
        </div>

        <Card>
          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500">
              <div className="mb-2 text-3xl">🔔</div>
              {filter === "unread" ? "No unread notifications." : "No notifications yet."}
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {items.map((n) => {
                const meta = META[n.type] ?? META.system;
                const inner = (
                  <div
                    className={`flex items-start gap-3 px-1 py-3 ${
                      !n.isRead ? "bg-blue-50/40 -mx-3 px-3 rounded-lg" : ""
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ${meta.color}`}>
                      {meta.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className={!n.isRead ? "font-semibold text-zinc-900" : "text-zinc-800"}>
                          {n.title}
                        </div>
                        {!n.isRead && (
                          <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                        )}
                      </div>
                      {n.body && <div className="mt-0.5 text-sm text-zinc-600">{n.body}</div>}
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-400">
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600">
                          {meta.label}
                        </span>
                        <span>{new Date(n.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );

                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link href={n.link} onClick={() => markOne(n.id)} className="block hover:bg-zinc-50 -mx-3 px-3">
                        {inner}
                      </Link>
                    ) : (
                      <button
                        onClick={() => markOne(n.id)}
                        className="block w-full text-left hover:bg-zinc-50 -mx-3 px-3"
                      >
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
