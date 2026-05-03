"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken, getToken, parseJwt } from "../lib/clientAuth";
import { useEffect, useMemo, useRef, useState } from "react";
import { NotificationBell } from "./NotificationBell";

type Org = { title: string; logoUrl: string | null };

type AdminItem =
  | { kind: "link"; href: string; label: string; icon: React.ReactNode }
  | { kind: "sep"; label: string }
  | { kind: "query"; label: string; href: string; query: string };

const adminItems: AdminItem[] = [
  { kind: "link", href: "/admin/dashboard", label: "Dashboard", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
  { kind: "sep", label: "Staff" },
  { kind: "link", href: "/admin/users", label: "Users", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { kind: "link", href: "/admin/offices", label: "Offices", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { kind: "link", href: "/admin/org", label: "Organization", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg> },
  { kind: "sep", label: "Attendance" },
  { kind: "link", href: "/admin/qr", label: "Daily QR", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/><rect x="3" y="16" width="5" height="5"/><path d="M21 16h-3a2 2 0 0 0-2 2v3M16 21h5M21 16v5"/></svg> },
  { kind: "link", href: "/admin/qr-history", label: "QR History", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { kind: "link", href: "/admin/attendance", label: "Attendance Log", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
  { kind: "link", href: "/admin/hours", label: "Work Hours", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { kind: "link", href: "/admin/leaves", label: "Leaves", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8" y2="14" strokeWidth="3"/></svg> },
  { kind: "link", href: "/admin/leave-balance", label: "Leave Balance", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
  { kind: "link", href: "/admin/corrections", label: "Corrections", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> },
  { kind: "link", href: "/admin/holidays", label: "Holidays", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> },
  { kind: "link", href: "/admin/workday-overrides", label: "Work Overrides", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg> },
  { kind: "link", href: "/admin/outstation", label: "Outstation", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg> },
  { kind: "sep", label: "Sales" },
  { kind: "link", href: "/admin/sales/dashboard", label: "Sales Dashboard", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { kind: "link", href: "/admin/sales/orders", label: "Order Approvals", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> },
  { kind: "link", href: "/admin/sales/reports", label: "Sales Reports", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { kind: "link", href: "/admin/sales/products", label: "Products", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> },
  { kind: "link", href: "/admin/sales/regions", label: "Regions", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
  { kind: "link", href: "/admin/sales/customers", label: "Customer Regions", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg> },
  { kind: "link", href: "/admin/sales/weekly-plans", label: "Weekly Plans", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { kind: "link", href: "/admin/sales/plans", label: "Daily Plans", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6" strokeWidth="3"/><line x1="3" y1="12" x2="3.01" y2="12" strokeWidth="3"/><line x1="3" y1="18" x2="3.01" y2="18" strokeWidth="3"/></svg> },
  { kind: "sep", label: "HR" },
  { kind: "link", href: "/admin/hr/reports", label: "HR Reports", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
  { kind: "link", href: "/admin/hr/directory", label: "Employee Directory", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="23 21 23 19 20 17"/><polyline points="16 17 20 17 20 21"/></svg> },
  { kind: "link", href: "/admin/hr/contracts", label: "Contracts", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
  { kind: "link", href: "/admin/hr/salary", label: "Payroll & Salary", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
  { kind: "link", href: "/admin/hr/performance", label: "Performance", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
  { kind: "link", href: "/admin/hr/training", label: "Training & Dev", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
  { kind: "link", href: "/admin/hr/disciplinary", label: "Disciplinary", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="3"/></svg> },
  { kind: "sep", label: "System" },
  { kind: "link", href: "/admin/activity-log", label: "Activity Log", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { kind: "link", href: "/admin/notifications", label: "Send Announcement", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
];

const adminLinks = adminItems.filter((i): i is Extract<AdminItem, { kind: "link" }> => i.kind === "link");

const adminSearchSources = [
  { label: "Dashboard", href: "/admin/dashboard", query: "dashboard" },
  { label: "Users", href: "/admin/users", query: "users employee staff name email department role" },
  { label: "Offices", href: "/admin/offices", query: "offices office location" },
  { label: "Organization", href: "/admin/org", query: "organization org company" },
  { label: "Daily QR", href: "/admin/qr", query: "qr check in attendance" },
  { label: "QR History", href: "/admin/qr-history", query: "qr history scan log" },
  { label: "Attendance Log", href: "/admin/attendance", query: "attendance employee check in check out" },
  { label: "Work Hours", href: "/admin/hours", query: "work hours shift time" },
  { label: "Leaves", href: "/admin/leaves", query: "leave leave request employee name" },
  { label: "Leave Balance", href: "/admin/leave-balance", query: "leave balance employee name" },
  { label: "Corrections", href: "/admin/corrections", query: "correction attendance employee name" },
  { label: "Holidays", href: "/admin/holidays", query: "holiday holidays off day" },
  { label: "Work Overrides", href: "/admin/workday-overrides", query: "override workday employees" },
  { label: "Outstation", href: "/admin/outstation", query: "outstation travel employee" },
  { label: "Sales Dashboard", href: "/admin/sales/dashboard", query: "sales dashboard" },
  { label: "Order Approvals", href: "/admin/sales/orders", query: "orders order approvals customer shop sale" },
  { label: "Sales Reports", href: "/admin/sales/reports", query: "sales reports customer shop product order" },
  { label: "Products", href: "/admin/sales/products", query: "products product name price item" },
  { label: "Regions", href: "/admin/sales/regions", query: "regions area territory" },
  { label: "Customer Regions", href: "/admin/sales/customers", query: "customers customer shop name region" },
  { label: "Weekly Plans", href: "/admin/sales/weekly-plans", query: "weekly plans customer shop route" },
  { label: "Daily Plans", href: "/admin/sales/plans", query: "daily plans customer shop route" },
  { label: "HR Reports", href: "/admin/hr/reports", query: "hr reports employee name" },
  { label: "Employee Directory", href: "/admin/hr/directory", query: "employee directory staff name department" },
  { label: "Contracts", href: "/admin/hr/contracts", query: "contracts employee name" },
  { label: "Payroll & Salary", href: "/admin/hr/salary", query: "salary payroll employee name" },
  { label: "Performance", href: "/admin/hr/performance", query: "performance employee name" },
  { label: "Training & Dev", href: "/admin/hr/training", query: "training employee name" },
  { label: "Disciplinary", href: "/admin/hr/disciplinary", query: "disciplinary employee name" },
  { label: "Activity Log", href: "/admin/activity-log", query: "activity log audit" },
  { label: "Send Announcement", href: "/admin/notifications", query: "announcement notification message" },
] as const;

function NavLink({
  href,
  active,
  children,
  onClick,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const [tapped, setTapped] = useState(false);

  const handleClick = () => {
    setTapped(true);
    onClick?.();
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={`
        relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors duration-100
        ${active ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-700 hover:bg-zinc-100"}
        active:bg-zinc-200 active:scale-[0.97]
      `}
    >
      {children}
      {tapped && !active && (
        <span className="ml-0.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
      )}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [token, setTok] = useState<string | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminSearch, setAdminSearch] = useState("");
  const adminRef = useRef<HTMLDivElement>(null);
  const adminSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTok(getToken());
    setMenuOpen(false);
    setAdminOpen(false);
    setAdminSearch("");
  }, [pathname]);

  useEffect(() => {
    if (adminOpen) {
      setAdminSearch("");
      setTimeout(() => adminSearchRef.current?.focus(), 60);
    }
  }, [adminOpen]);

  useEffect(() => {
    fetch("/api/org", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setOrg(d?.org ?? null))
      .catch(() => setOrg(null));
  }, [pathname]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (adminRef.current && !adminRef.current.contains(e.target as Node)) {
        setAdminOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingByKey, setPendingByKey] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!token) {
      setPendingTotal(0);
      setPendingByKey({});
      return;
    }
    let alive = true;
    const fetchPending = async () => {
      try {
        const r = await fetch("/api/pending-summary", {
          headers: { authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!r.ok) return;
        const j = await r.json();
        if (!alive) return;
        setPendingTotal(j?.total ?? 0);
        const map: Record<string, number> = {};
        for (const g of (j?.groups ?? []) as Array<{ key: string; count: number }>) {
          map[g.key] = g.count;
        }
        setPendingByKey(map);
      } catch {
        /* ignore */
      }
    };
    fetchPending();
    const id = setInterval(fetchPending, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [token, pathname]);

  const adminLinkPendingCount = (href: string): number => {
    if (href === "/admin/sales/orders") return pendingByKey.orders ?? 0;
    if (href === "/admin/leaves") return pendingByKey.leaves ?? 0;
    if (href === "/admin/corrections") return pendingByKey.corrections ?? 0;
    if (href === "/admin/outstation") return pendingByKey.outstation ?? 0;
    return 0;
  };

  const filteredAdminItems = useMemo<AdminItem[]>(() => {
    const q = adminSearch.trim().toLowerCase();
    if (!q) return adminItems;
    const result: AdminItem[] = [];
    let pendingSep: AdminItem | null = null;
    for (const item of adminItems) {
      if (item.kind === "sep") {
        pendingSep = item;
      } else if (
        item.label.toLowerCase().includes(q) ||
        adminSearchSources.some((s) => s.href === item.href && s.query.includes(q))
      ) {
        if (pendingSep) { result.push(pendingSep); pendingSep = null; }
        result.push(item);
      }
    }
    return result;
  }, [adminSearch]);

  const onLogout = () => {
    clearToken();
    window.location.href = "/login";
  };

  const isAdminActive = adminLinks.some((l) => pathname === l.href);

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4">

          <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold text-zinc-900">
            {org?.logoUrl ? (
              <img
                src={org.logoUrl}
                alt="Logo"
                className="h-7 w-7 rounded-lg border border-zinc-200 bg-white object-cover"
              />
            ) : null}
            <span className="max-w-[130px] truncate sm:max-w-none">{org?.title ?? "Attendance"}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5 text-sm min-w-0">
            <NavLink href="/employee" active={pathname === "/employee"}>
              <span className="inline-flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Check In/Out
              </span>
            </NavLink>
            <NavLink href="/employee/history" active={pathname.startsWith("/employee/history")}>
              <span className="inline-flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                My History
              </span>
            </NavLink>
            <NavLink href="/sales" active={pathname.startsWith("/sales")}>
              <span className="inline-flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
                Sales
              </span>
            </NavLink>
            <NavLink href="/profile" active={pathname === "/profile"}>
              <span className="inline-flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Profile
              </span>
            </NavLink>
            {user && (
              <NavLink href="/pending" active={pathname === "/pending"}>
                <span className="inline-flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  Pending
                  {pendingTotal > 0 && (
                    <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold leading-5 text-white">
                      {pendingTotal > 99 ? "99+" : pendingTotal}
                    </span>
                  )}
                </span>
              </NavLink>
            )}
            {(user?.role === "manager" || user?.role === "admin") && (
              <NavLink href="/manager" active={pathname.startsWith("/manager")}>
                <span className="inline-flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Manager
                </span>
              </NavLink>
            )}

            {user?.role === "admin" && (
              <div ref={adminRef} className="relative">
                <button
                  onClick={() => setAdminOpen((v) => !v)}
                  className={`
                    flex items-center gap-1 rounded-lg px-3 py-2 text-sm transition-colors duration-100
                    ${isAdminActive ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-700 hover:bg-zinc-100"}
                    active:bg-zinc-200
                  `}
                >
                  Admin
                  <svg
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${adminOpen ? "rotate-180" : ""}`}
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="2,4 6,8 10,4" />
                  </svg>
                </button>

                {adminOpen && (
                  <div className="absolute right-0 top-full mt-1 w-64 rounded-xl border border-zinc-200 bg-white shadow-lg z-30 flex flex-col max-h-[82vh]">
                    {/* Search bar */}
                    <div className="sticky top-0 z-10 bg-white px-3 pt-2.5 pb-2 border-b border-zinc-100">
                      <div className="relative">
                        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input
                          ref={adminSearchRef}
                          type="text"
                          value={adminSearch}
                          onChange={(e) => setAdminSearch(e.target.value)}
                          onKeyDown={(e) => e.key === "Escape" && setAdminOpen(false)}
                          placeholder="Search admin pages…"
                          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-3 text-xs text-zinc-800 placeholder-zinc-400 outline-none focus:border-zinc-400 focus:bg-white"
                        />
                        {adminSearch && (
                          <button
                            type="button"
                            onClick={() => { setAdminSearch(""); adminSearchRef.current?.focus(); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Results list */}
                    <div className="overflow-y-auto py-1.5">
                      {filteredAdminItems.length === 0 ? (
                        <div className="px-4 py-5 text-center text-xs text-zinc-400">No pages match "{adminSearch}"</div>
                      ) : (
                        filteredAdminItems.map((item, i) => {
                          if (item.kind === "sep") {
                            return (
                              <div key={`sep-${i}`} className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                                {item.label}
                              </div>
                            );
                          }
                          const c = adminLinkPendingCount(item.href);
                          const q = adminSearch.trim().toLowerCase();
                          const label = item.label;
                          const idx = q ? label.toLowerCase().indexOf(q) : -1;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setAdminOpen(false)}
                              className={`
                                flex items-center gap-2.5 px-4 py-2 text-sm transition-colors duration-100
                                ${pathname === item.href ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-700 hover:bg-zinc-50"}
                                active:bg-zinc-200
                              `}
                            >
                              <span className="shrink-0 text-zinc-400">{item.icon}</span>
                              <span className="flex-1">
                                {idx >= 0 ? (
                                  <>
                                    {label.slice(0, idx)}
                                    <mark className="bg-yellow-100 text-yellow-800 rounded-sm px-0.5">{label.slice(idx, idx + q.length)}</mark>
                                    {label.slice(idx + q.length)}
                                  </>
                                ) : label}
                              </span>
                              {c > 0 && (
                                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold leading-5 text-white">
                                  {c > 99 ? "99+" : c}
                                </span>
                              )}
                            </Link>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <NotificationBell enabled={!!user} />

            {user ? (
              <button
                onClick={onLogout}
                className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors duration-100"
              >
                Logout
              </button>
            ) : (
              <NavLink href="/login" active={pathname === "/login"}>
                Login
              </NavLink>
            )}
          </nav>

          <div className="md:hidden flex items-center gap-1">
            <NotificationBell enabled={!!user} />
            <button
              className="rounded-lg p-2 text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200 transition-colors duration-100"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {menuOpen ? (
                  <>
                    <line x1="4" y1="4" x2="18" y2="18" />
                    <line x1="18" y1="4" x2="4" y2="18" />
                  </>
                ) : (
                  <>
                    <line x1="3" y1="6" x2="19" y2="6" />
                    <line x1="3" y1="11" x2="19" y2="11" />
                    <line x1="3" y1="16" x2="19" y2="16" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-zinc-100 bg-white px-3 py-2 flex flex-col gap-0.5 text-sm shadow-md max-h-[80vh] overflow-y-auto">
            <MobileNavLink href="/employee" active={pathname === "/employee"} onClick={() => setMenuOpen(false)}>
              <span className="inline-flex items-center gap-2.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Check In / Out
              </span>
            </MobileNavLink>
            <MobileNavLink href="/employee/history" active={pathname.startsWith("/employee/history")} onClick={() => setMenuOpen(false)}>
              <span className="inline-flex items-center gap-2.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                My History
              </span>
            </MobileNavLink>
            <MobileNavLink href="/sales" active={pathname.startsWith("/sales")} onClick={() => setMenuOpen(false)}>
              <span className="inline-flex items-center gap-2.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
                Sales
              </span>
            </MobileNavLink>
            <MobileNavLink href="/profile" active={pathname === "/profile"} onClick={() => setMenuOpen(false)}>
              <span className="inline-flex items-center gap-2.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Profile
              </span>
            </MobileNavLink>
            {user && (
              <MobileNavLink href="/pending" active={pathname === "/pending"} onClick={() => setMenuOpen(false)}>
                <span className="inline-flex items-center gap-2.5">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  Pending
                  {pendingTotal > 0 && (
                    <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold leading-5 text-white">
                      {pendingTotal > 99 ? "99+" : pendingTotal}
                    </span>
                  )}
                </span>
              </MobileNavLink>
            )}
            {(user?.role === "manager" || user?.role === "admin") && (
              <MobileNavLink href="/manager" active={pathname.startsWith("/manager")} onClick={() => setMenuOpen(false)}>
                <span className="inline-flex items-center gap-2.5">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Manager
                </span>
              </MobileNavLink>
            )}
            {user?.role === "admin" && (
              <>
                <div className="mt-2 mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Admin</div>
                {/* Mobile admin search */}
                <div className="px-2 pb-1">
                  <div className="relative">
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input
                      type="text"
                      value={adminSearch}
                      onChange={(e) => setAdminSearch(e.target.value)}
                      placeholder="Search admin pages…"
                      className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-8 text-xs text-zinc-800 placeholder-zinc-400 outline-none focus:border-zinc-400 focus:bg-white"
                    />
                    {adminSearch && (
                      <button
                        type="button"
                        onClick={() => setAdminSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    )}
                  </div>
                </div>
                {filteredAdminItems.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-zinc-400">No pages match "{adminSearch}"</div>
                ) : (
                  filteredAdminItems.map((item, i) => {
                    if (item.kind === "sep") {
                      return (
                        <div key={`msep-${i}`} className="mt-2 mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                          {item.label}
                        </div>
                      );
                    }
                    const c = adminLinkPendingCount(item.href);
                    const q = adminSearch.trim().toLowerCase();
                    const label = item.label;
                    const idx = q ? label.toLowerCase().indexOf(q) : -1;
                    return (
                      <MobileNavLink key={item.href} href={item.href} active={pathname === item.href} onClick={() => setMenuOpen(false)}>
                        <span className="inline-flex w-full items-center gap-2.5">
                          <span className="shrink-0 text-zinc-400">{item.icon}</span>
                          <span className="flex-1">
                            {idx >= 0 ? (
                              <>
                                {label.slice(0, idx)}
                                <mark className="bg-yellow-100 text-yellow-800 rounded-sm px-0.5">{label.slice(idx, idx + q.length)}</mark>
                                {label.slice(idx + q.length)}
                              </>
                            ) : label}
                          </span>
                          {c > 0 && (
                            <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold leading-5 text-white">
                              {c > 99 ? "99+" : c}
                            </span>
                          )}
                        </span>
                      </MobileNavLink>
                    );
                  })
                )}
              </>
            )}
            {user ? (
              <button
                onClick={onLogout}
                className="mt-1 rounded-lg px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors duration-100"
              >
                Logout
              </button>
            ) : (
              <MobileNavLink href="/login" active={pathname === "/login"} onClick={() => setMenuOpen(false)}>
                Login
              </MobileNavLink>
            )}
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-24 sm:py-8 md:pb-8">{children}</main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs text-zinc-500 hidden md:block">
        {user ? `Signed in as ${user.role}` : ""}
      </footer>

      {/* Mobile bottom navigation */}
      {user && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-zinc-200 bg-white/95 backdrop-blur-sm flex h-16 items-stretch safe-area-inset-bottom">
          {[
            {
              href: "/employee",
              label: "Check In",
              active: pathname === "/employee",
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
            },
            {
              href: "/sales",
              label: "Sales",
              active: pathname.startsWith("/sales"),
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>,
            },
            {
              href: "/employee/history",
              label: "History",
              active: pathname.startsWith("/employee/history"),
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
            },
            {
              href: "/profile",
              label: "Profile",
              active: pathname === "/profile",
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
            },
          ].map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
                tab.active ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
              }`}
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${tab.active ? "bg-zinc-100" : ""}`}>
                {tab.icon}
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

function MobileNavLink({
  href,
  active,
  children,
  onClick,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const [tapped, setTapped] = useState(false);

  const handleClick = () => {
    setTapped(true);
    onClick?.();
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={`
        flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors duration-100
        ${active ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-700 hover:bg-zinc-50"}
        active:bg-zinc-200
      `}
    >
      <span>{children}</span>
      {tapped && !active ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
      ) : active ? (
        <span className="text-zinc-400">✓</span>
      ) : (
        <svg className="h-4 w-4 text-zinc-300" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="6,3 11,8 6,13" />
        </svg>
      )}
    </Link>
  );
}
