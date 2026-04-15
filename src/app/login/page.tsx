"use client";

import { useState, useEffect } from "react";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { apiFetch } from "../../lib/clientApi";
import { clearToken, getToken, parseJwt, setToken } from "../../lib/clientAuth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);

  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [logoExpanded, setLogoExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/org")
      .then((r) => r.json())
      .then((data) => {
        if (data?.org) {
          setOrgName(data.org.title ?? null);
          setOrgLogo(data.org.logoUrl ?? null);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = getToken();
    if (!t) return;
    const jwt = parseJwt(t);
    if (!jwt) {
      clearToken();
      return;
    }

    (async () => {
      try {
        await apiFetch("/api/me");
        if (jwt.role === "admin" || jwt.role === "manager") {
          window.location.href = "/admin/attendance";
        } else {
          window.location.href = "/employee";
        }
      } catch {
        clearToken();
      }
    })();
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: { role: string } }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password, rememberMe }),
      });
      setToken(res.token, rememberMe);
      if (res.user.role === "admin" || res.user.role === "manager") {
        window.location.href = "/admin/attendance";
      } else {
        window.location.href = "/employee";
      }
    } catch (err: any) {
      setError(err?.message ?? "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
      <div className="w-full max-w-md">
        <Card>
          <div className="p-6">
            <div className="text-center mb-6">
              {orgLogo && (
                <>
                  <button
                    type="button"
                    onClick={() => setLogoExpanded(true)}
                    className="mx-auto mb-3 block focus:outline-none"
                  >
                    <img
                      src={orgLogo}
                      alt={orgName ?? "Organization logo"}
                      className="h-20 w-20 rounded-full object-cover border border-zinc-200 shadow-sm hover:opacity-90 transition-opacity"
                    />
                  </button>
                  {logoExpanded && (
                    <button
                      type="button"
                      onClick={() => setLogoExpanded(false)}
                      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm w-full focus:outline-none"
                    >
                      <img
                        src={orgLogo}
                        alt={orgName ?? "Organization logo"}
                        className="h-64 w-64 rounded-2xl object-cover shadow-2xl border-4 border-white"
                      />
                    </button>
                  )}
                </>
              )}
              <h1 className="text-2xl font-bold">{orgName ?? "Attendance System"}</h1>
              <p className="text-gray-500 text-sm">Sign in to your account</p>
            </div>

            {error && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 text-center">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Email address</label>
                <Input
                  type="text"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Password</label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sr-only"
                    disabled={loading}
                  />
                  <div
                    className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors duration-150 ${
                      rememberMe
                        ? "bg-zinc-900 border-zinc-900"
                        : "bg-white border-zinc-300"
                    }`}
                  >
                    {rememberMe && (
                      <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="2,6 5,9 10,3" />
                      </svg>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-zinc-700 font-medium">Keep me signed in</span>
                  <span className="ml-1.5 text-xs text-zinc-400">
                    {rememberMe ? "30 days" : "7 days"}
                  </span>
                </div>
              </label>

              <Button
                type="button"
                onClick={handleLogin}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
