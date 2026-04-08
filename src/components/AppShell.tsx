"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken, getToken, parseJwt } from "../lib/clientAuth";
import { useEffect, useMemo, useState } from "react";

type Org = { title: string; logoUrl: string | null };

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [token, setTok] = useState<string | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setTok(getToken());
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    fetch("/api/org", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setOrg(d?.org ?? null))
      .catch(() => setOrg(null));
  }, [pathname]);

  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const onLogout = () => {
    clearToken();
    window.location.href = "/login";
  };

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
    { href: "/admin/org", label: "Organization" },
  ];

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold text-zinc-900">
            {org?.logoUrl ? (
              <img
                src={org.logoUrl}
                alt="Logo"
                className="h-7 w-7 rounded-lg border border-zinc-200 bg-white object-cover"
              />
            ) : null}
            <span className="max-w-[140px] truncate sm:max-w-none">{org?.title ?? "Attendance"}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm">
            <Link
              href="/employee"
              className={`rounded-lg px-3 py-2 hover:bg-zinc-100 ${pathname === "/employee" ? "bg-zinc-100 font-medium" : ""}`}
            >
              Check In/Out
            </Link>
            <Link
              href="/employee/history"
              className={`rounded-lg px-3 py-2 hover:bg-zinc-100 ${pathname.startsWith("/employee/history") ? "bg-zinc-100 font-medium" : ""}`}
            >
              My History
            </Link>
            <Link
              href="/profile"
              className={`rounded-lg px-3 py-2 hover:bg-zinc-100 ${pathname === "/profile" ? "bg-zinc-100 font-medium" : ""}`}
            >
              Profile
            </Link>
            {(user?.role === "manager" || user?.role === "admin") && (
              <Link
                href="/manager"
                className={`rounded-lg px-3 py-2 hover:bg-zinc-100 ${pathname.startsWith("/manager") ? "bg-zinc-100 font-medium" : ""}`}
              >
                Manager
              </Link>
            )}
            {user?.role === "admin" ? (
              <>
                {adminLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`rounded-lg px-3 py-2 hover:bg-zinc-100 ${pathname === l.href ? "bg-zinc-100 font-medium" : ""}`}
                  >
                    {l.label}
                  </Link>
                ))}
              </>
            ) : null}
            {user ? (
              <button onClick={onLogout} className="rounded-lg px-3 py-2 text-red-600 hover:bg-red-50">
                Logout
              </button>
            ) : (
              <Link href="/login" className="rounded-lg px-3 py-2 hover:bg-zinc-100">
                Login
              </Link>
            )}
          </nav>

          <button
            className="md:hidden rounded-lg p-2 hover:bg-zinc-100"
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

        {menuOpen && (
          <div className="md:hidden border-t border-zinc-100 bg-white px-4 py-3 flex flex-col gap-1 text-sm shadow-md">
            <Link href="/employee" className={`rounded-lg px-3 py-2 hover:bg-zinc-100 ${pathname === "/employee" ? "bg-zinc-100 font-medium" : ""}`}>
              Check In/Out
            </Link>
            <Link href="/employee/history" className={`rounded-lg px-3 py-2 hover:bg-zinc-100 ${pathname.startsWith("/employee/history") ? "bg-zinc-100 font-medium" : ""}`}>
              My History
            </Link>
            <Link href="/profile" className={`rounded-lg px-3 py-2 hover:bg-zinc-100 ${pathname === "/profile" ? "bg-zinc-100 font-medium" : ""}`}>
              Profile
            </Link>
            {(user?.role === "manager" || user?.role === "admin") && (
              <Link href="/manager" className={`rounded-lg px-3 py-2 hover:bg-zinc-100 ${pathname.startsWith("/manager") ? "bg-zinc-100 font-medium" : ""}`}>
                Manager
              </Link>
            )}
            {user?.role === "admin" ? (
              <>
                {adminLinks.map((l) => (
                  <Link key={l.href} href={l.href} className={`rounded-lg px-3 py-2 hover:bg-zinc-100 ${pathname === l.href ? "bg-zinc-100 font-medium" : ""}`}>
                    {l.label}
                  </Link>
                ))}
              </>
            ) : null}
            {user ? (
              <button onClick={onLogout} className="rounded-lg px-3 py-2 text-left text-red-600 hover:bg-red-50">Logout</button>
            ) : (
              <Link href="/login" className="rounded-lg px-3 py-2 hover:bg-zinc-100">Login</Link>
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
