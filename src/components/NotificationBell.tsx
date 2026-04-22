"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../lib/clientApi";

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

const TYPE_META: Record<NotifType, { icon: string; color: string }> = {
  leave_submitted:      { icon: "📅", color: "bg-blue-100 text-blue-700" },
  leave_decided:        { icon: "✅", color: "bg-emerald-100 text-emerald-700" },
  correction_submitted: { icon: "✏️", color: "bg-amber-100 text-amber-700" },
  correction_decided:   { icon: "✏️", color: "bg-emerald-100 text-emerald-700" },
  qr_generated:         { icon: "📱", color: "bg-violet-100 text-violet-700" },
  late_check_in:        { icon: "⏰", color: "bg-rose-100 text-rose-700" },
  broadcast:            { icon: "📣", color: "bg-indigo-100 text-indigo-700" },
  system:               { icon: "🔔", color: "bg-zinc-100 text-zinc-700" },
};

function relTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationBell({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const r = await apiFetch<{ items: Notif[]; unreadCount: number }>(
        "/api/notifications?limit=10",
      );
      setItems(r.items);
      setUnread(r.unreadCount);
    } catch {
      // silent — just keeps previous state
    } finally {
      setLoading(false);
    }
  };

  // Poll every 30 s + reload on route change
  useEffect(() => {
    if (!enabled) return;
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pathname]);

  // Click-outside
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  if (!enabled) return null;

  const markAllRead = async () => {
    try {
      await apiFetch("/api/notifications/read", {
        method: "POST",
        body: JSON.stringify({ all: true }),
      });
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnread(0);
    } catch {
      // ignore
    }
  };

  const onItemClick = async (n: Notif) => {
    setOpen(false);
    try {
      if (!n.isRead) {
        await apiFetch("/api/notifications/read", {
          method: "POST",
          body: JSON.stringify({ id: n.id }),
        });
        setUnread((u) => Math.max(0, u - 1));
      }
    } catch {
      // ignore
    }
    if (n.link) router.push(n.link);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
          open ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
        }`}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>

        {unread > 0 && (
          unread === 1 ? (
            <span className="pointer-events-none absolute right-[9px] top-[9px] h-[7px] w-[7px] rounded-full bg-zinc-900 ring-2 ring-white" />
          ) : (
            <span className="pointer-events-none absolute right-1 top-1 inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-zinc-900 px-[3px] text-[9px] font-medium leading-none tracking-tight text-white ring-2 ring-white tabular-nums">
              {unread > 99 ? "99+" : unread}
            </span>
          )
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[340px] max-w-[92vw] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl z-30">
          <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2">
            <div className="text-sm font-semibold text-zinc-900">
              Notifications
              {unread > 0 && (
                <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                  {unread} new
                </span>
              )}
            </div>
            <button
              onClick={markAllRead}
              disabled={unread === 0}
              className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-40"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-500">Loading…</div>
            ) : items.length === 0 ? (
              <div className="p-6 text-center text-sm text-zinc-500">
                <div className="mb-1 text-2xl">🔔</div>
                You're all caught up.
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {items.map((n) => {
                  const meta = TYPE_META[n.type] ?? TYPE_META.system;
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => onItemClick(n)}
                        className={`flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-zinc-50 ${
                          !n.isRead ? "bg-blue-50/40" : ""
                        }`}
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base ${meta.color}`}>
                          {meta.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className={`text-sm leading-snug ${!n.isRead ? "font-semibold text-zinc-900" : "text-zinc-800"}`}>
                              {n.title}
                            </div>
                            {!n.isRead && (
                              <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                            )}
                          </div>
                          {n.body && (
                            <div className="mt-0.5 line-clamp-2 text-xs text-zinc-600">
                              {n.body}
                            </div>
                          )}
                          <div className="mt-1 text-[10px] uppercase tracking-wide text-zinc-400">
                            {relTime(n.createdAt)}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-zinc-100 px-3 py-2 text-center">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-zinc-700 hover:text-zinc-900"
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
