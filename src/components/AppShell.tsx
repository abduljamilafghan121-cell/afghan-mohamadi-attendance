"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken, getToken, parseJwt } from "../lib/clientAuth";
import { useEffect, useMemo, useRef, useState } from "react";
import { NotificationBell } from "./NotificationBell";

type Org = { title: string; logoUrl: string | null };

const adminLinks = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/offices", label: "Offices" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/qr", label: "Daily QR" },
  { href: "/admin/qr-history", label: "QR History" },
  { href: "/admin/attendance", label: "Attendance" },
  { href: "/admin/hours", label: "Hours" },
  { href: "/admin/leaves", label: "Leaves" },
  { href: "/admin/leave-balance", label: "Leave Balance" },
  { href: "/admin/corrections", label: "Corrections" },
  { href: "/admin/holidays", label: "Holidays" },
  { href: "/admin/workday-overrides", label: "Overrides" },
  { href: "/admin/sales/dashboard", label: "Sales Dashboard" },
  { href: "/admin/sales/reports", label: "Sales Reports" },
  { href: "/admin/sales/products", label: "Products" },
  { href: "/admin/sales/regions", label: "Regions" },
  { href: "/admin/sales/customers", label: "Customer Regions" },
  { href: "/admin/sales/weekly-plans", label: "Weekly Plans" },
  { href: "/admin/sales/plans", label: "Daily Plans" },
  { href: "/admin/notifications", label: "Send Announcement" },
  { href: "/admin/org", label: "Organization" },
];

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
  const adminRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTok(getToken());
    setMenuOpen(false);
    setAdminOpen(false);
  }, [pathname]);

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
              Check In/Out
            </NavLink>
            <NavLink href="/employee/history" active={pathname.startsWith("/employee/history")}>
              My History
            </NavLink>
            <NavLink href="/sales" active={pathname.startsWith("/sales")}>
              Sales
            </NavLink>
            <NavLink href="/profile" active={pathname === "/profile"}>
              Profile
            </NavLink>
            {(user?.role === "manager" || user?.role === "admin") && (
              <NavLink href="/manager" active={pathname.startsWith("/manager")}>
                Manager
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
                  <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-zinc-200 bg-white py-1.5 shadow-lg z-30">
                    {adminLinks.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        onClick={() => setAdminOpen(false)}
                        className={`
                          block px-4 py-2 text-sm transition-colors duration-100
                          ${pathname === l.href ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-700 hover:bg-zinc-50"}
                          active:bg-zinc-200
                        `}
                      >
                        {l.label}
                      </Link>
                    ))}
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
              Check In / Out
            </MobileNavLink>
            <MobileNavLink href="/employee/history" active={pathname.startsWith("/employee/history")} onClick={() => setMenuOpen(false)}>
              My History
            </MobileNavLink>
            <MobileNavLink href="/sales" active={pathname.startsWith("/sales")} onClick={() => setMenuOpen(false)}>
              Sales
            </MobileNavLink>
            <MobileNavLink href="/profile" active={pathname === "/profile"} onClick={() => setMenuOpen(false)}>
              Profile
            </MobileNavLink>
            {(user?.role === "manager" || user?.role === "admin") && (
              <MobileNavLink href="/manager" active={pathname.startsWith("/manager")} onClick={() => setMenuOpen(false)}>
                Manager
              </MobileNavLink>
            )}
            {user?.role === "admin" && (
              <>
                <div className="mt-2 mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Admin
                </div>
                {adminLinks.map((l) => (
                  <MobileNavLink key={l.href} href={l.href} active={pathname === l.href} onClick={() => setMenuOpen(false)}>
                    {l.label}
                  </MobileNavLink>
                ))}
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

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">{children}</main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs text-zinc-500">
        {user ? `Signed in as ${user.role}` : ""}
      </footer>
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
