"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/clientApi";
import { getToken, parseJwt } from "../../lib/clientAuth";

type PendingItem = {
  id: string;
  title: string;
  subtitle: string;
  createdAt: string;
  link: string;
  user?: { id: string; name: string };
};
type PendingGroup = {
  key: "orders" | "leaves" | "corrections" | "outstation";
  label: string;
  count: number;
  items: PendingItem[];
  reviewLink: string;
};
type PendingResponse = {
  total: number;
  groups: PendingGroup[];
  scope: "all" | "mine";
};

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString();
}

const groupAccent: Record<PendingGroup["key"], string> = {
  orders: "bg-emerald-50 text-emerald-700 border-emerald-200",
  leaves: "bg-blue-50 text-blue-700 border-blue-200",
  corrections: "bg-amber-50 text-amber-700 border-amber-200",
  outstation: "bg-violet-50 text-violet-700 border-violet-200",
};

export default function PendingPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);
  const isAdmin = user?.role === "admin";
  const [data, setData] = useState<PendingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch<PendingResponse>("/api/pending-summary");
      setData(r);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Pending items</h1>
          <p className="text-sm text-zinc-500">
            {isAdmin
              ? "Everything across the company that is awaiting your decision."
              : "Everything you have submitted that is still awaiting an admin decision."}
          </p>
        </div>
        <button
          onClick={load}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Refresh
        </button>
      </div>

      {loading && <div className="text-sm text-zinc-500">Loading…</div>}
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {data && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {data.groups.map((g) => (
              <Link
                key={g.key}
                href={g.reviewLink}
                className={`rounded-xl border p-3 text-left transition hover:shadow-sm ${groupAccent[g.key]}`}
              >
                <div className="text-2xl font-semibold leading-none">{g.count}</div>
                <div className="mt-1 text-xs font-medium">{g.label}</div>
              </Link>
            ))}
          </div>

          {data.total === 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
              Nothing is pending. You're all caught up.
            </div>
          )}

          <div className="space-y-5">
            {data.groups
              .filter((g) => g.count > 0)
              .map((g) => (
                <section key={g.key}>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-zinc-800">
                      {g.label}{" "}
                      <span className="text-zinc-400">({g.count})</span>
                    </h2>
                    <Link
                      href={g.reviewLink}
                      className="text-xs text-zinc-600 underline-offset-2 hover:underline"
                    >
                      {isAdmin ? "Review all →" : "Open →"}
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {g.items.map((it) => (
                      <Link
                        key={it.id}
                        href={it.link}
                        className="block rounded-xl border border-zinc-200 bg-white p-3 hover:bg-zinc-50"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-medium text-zinc-900">{it.title}</div>
                          <div className="text-xs text-zinc-500">{fmtDateTime(it.createdAt)}</div>
                        </div>
                        <div className="text-xs text-zinc-600">{it.subtitle}</div>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
