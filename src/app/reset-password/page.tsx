"use client";

import { useEffect, useState } from "react";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [validating, setValidating] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      setTokenError("No reset token found in the URL.");
      setValidating(false);
      return;
    }
    setToken(t);

    fetch(`/api/auth/reset-password?token=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) {
          setUserName(data.userName ?? null);
        } else {
          setTokenError(data.error || "Invalid or expired reset link.");
        }
      })
      .catch(() => setTokenError("Could not validate the reset link. Please try again."))
      .finally(() => setValidating(false));
  }, []);

  const handleSubmit = async () => {
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Error (HTTP ${res.status})`);
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <Card title="Reset Password">
          {validating && (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
            </div>
          )}

          {!validating && tokenError && (
            <div className="space-y-4">
              <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{tokenError}</div>
              <p className="text-sm text-zinc-500">
                Reset links expire after 1 hour. Ask your admin to generate a new one.
              </p>
              <a href="/login" className="block text-center text-sm font-medium text-zinc-700 hover:underline">
                Back to login
              </a>
            </div>
          )}

          {!validating && !tokenError && !done && (
            <div className="space-y-4">
              {userName && (
                <p className="text-sm text-zinc-600">
                  Setting new password for <span className="font-semibold">{userName}</span>.
                </p>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium">New Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Confirm Password</label>
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat your new password"
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
              </div>
              {error && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>
              )}
              <Button disabled={loading} onClick={handleSubmit} className="w-full">
                {loading ? "Saving..." : "Set New Password"}
              </Button>
            </div>
          )}

          {done && (
            <div className="space-y-4">
              <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
                Your password has been updated successfully.
              </div>
              <a
                href="/login"
                className="block w-full rounded-xl bg-zinc-900 py-2.5 text-center text-sm font-medium text-white hover:bg-zinc-800"
              >
                Go to Login
              </a>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
