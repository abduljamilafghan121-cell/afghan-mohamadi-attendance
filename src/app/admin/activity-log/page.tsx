"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "../../../lib/clientApi";

type LogUser = { id: string; name: string; role: string; employeeId: string | null };

type LogEntry = {
  id: string;
  action: string;
  module: string;
  details: string | null;
  createdAt: string;
  user: LogUser;
};

const MODULE_COLORS: Record<string, string> = {
  auth: "bg-purple-100 text-purple-700",
  attendance: "bg-blue-100 text-blue-700",
  leave: "bg-green-100 text-green-700",
  correction: "bg-amber-100 text-amber-700",
  sales: "bg-orange-100 text-orange-700",
  admin: "bg-red-100 text-red-700",
};

const ALL_MODULES = ["auth", "attendance", "leave", "correction", "sales", "admin"];

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

type User = { id: string; name: string };

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [filterUser, setFilterUser] = useState("");
  const [filterModule, setFilterModule] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [limit, setLimit] = useState(200);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiFetch<{ users: User[] }>("/api/admin/users");
      setUsers(res.users ?? []);
    } catch {
      // non-critical
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (filterUser) qs.set("userId", filterUser);
      if (filterModule) qs.set("module", filterModule);
      if (filterFrom) qs.set("from", filterFrom);
      if (filterTo) qs.set("to", filterTo);
      qs.set("limit", String(limit));

      const res = await apiFetch<{ logs: LogEntry[] }>(`/api/admin/activity-log?${qs.toString()}`);
      setLogs(res.logs ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [filterUser, filterModule, filterFrom, filterTo, limit]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Activity Log</h1>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">User</label>
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Module</label>
          <select
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="">All modules</option>
            {ALL_MODULES.map((m) => (
              <option key={m} value={m}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">From</label>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">To</label>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-500">Max rows</label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            {[50, 100, 200, 500].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={() => {
              setFilterUser("");
              setFilterModule("");
              setFilterFrom("");
              setFilterTo("");
              setLimit(200);
            }}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            Clear
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading && logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                  No activity found for the selected filters.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr
                key={log.id}
                className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors"
              >
                <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                  {fmt(log.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-800">{log.user.name}</div>
                  <div className="text-xs text-zinc-400 capitalize">{log.user.role}</div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${MODULE_COLORS[log.module] ?? "bg-zinc-100 text-zinc-600"}`}
                  >
                    {log.module}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-700">{log.action}</td>
                <td className="px-4 py-3 text-zinc-600">{log.details ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {logs.length > 0 && (
        <p className="text-right text-xs text-zinc-400">
          Showing {logs.length} {logs.length === limit ? `(limit reached — try narrowing your filters)` : "entries"}
        </p>
      )}
    </div>
  );
}
