"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/clientApi";

type Status = {
  canWork: boolean;
  isAdmin: boolean;
  isOffDay: boolean;
  isHoliday: boolean;
  holidayName: string | null;
  isOnLeave: boolean;
  leaveType: string | null;
  hasOverride: boolean;
  isOvertime: boolean;
  reason: "leave" | "holiday" | "offday" | null;
};

/**
 * Renders an informational banner explaining why sales actions
 * (visits, orders, payments, new customers, plans) are blocked
 * or marked as overtime today.
 *
 * - Red banner: today is blocked (leave / holiday / off day with no override).
 * - Orange banner: today is a holiday or off day, but admin granted overtime.
 * - Nothing: regular working day → no banner.
 */
export function WorkdayBanner() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Status>("/api/sales/today-status")
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) return null;
  if (status.isAdmin) return null;
  if (status.canWork && !status.isOvertime) return null;

  const headline = (() => {
    if (status.isOnLeave) {
      const lt = status.leaveType ? ` (${status.leaveType})` : "";
      return `You are on approved leave today${lt}`;
    }
    if (status.isHoliday) {
      return `Today is a public holiday${status.holidayName ? `: ${status.holidayName}` : ""}`;
    }
    if (status.isOffDay) {
      return "Today is your weekly off day";
    }
    return "Today is not a working day";
  })();

  if (status.isOvertime) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
        <span className="mt-0.5 shrink-0 text-lg">⚠</span>
        <div>
          <div className="font-medium">{headline}</div>
          <div className="mt-0.5 text-xs text-orange-700">
            An admin has marked today as overtime for you. Visits, orders,
            collections and new customers you record today will be tagged as
            overtime.
          </div>
        </div>
      </div>
    );
  }

  const subline = status.isOnLeave
    ? "Sales actions are disabled until your leave ends. Contact an admin if you need to work."
    : "Sales actions are disabled today. Ask an admin to mark today as overtime if you need to work.";

  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <span className="mt-0.5 shrink-0 text-lg">🚫</span>
      <div>
        <div className="font-medium">{headline}</div>
        <div className="mt-0.5 text-xs text-red-700">{subline}</div>
      </div>
    </div>
  );
}
