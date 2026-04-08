"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../components/AppShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { apiFetch } from "../../lib/clientApi";
import { getToken, parseJwt } from "../../lib/clientAuth";

type LeaveBalance = {
  leaveType: "annual" | "sick" | "casual" | "unpaid";
  entitlementDays: number;
  carriedOverDays: number;
  usedDays: number;
  remainingDays: number;
  isSet: boolean;
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "Annual",
  sick: "Sick",
  casual: "Casual",
  unpaid: "Unpaid",
};

type UserProfile = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  employeeId: string | null;
  phone: string | null;
  department: string | null;
  jobTitle: string | null;
  address: string | null;
  photoUrl: string | null;
  isActive: boolean;
  createdAt: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const jwtUser = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const load = async () => {
    setLoading(true);
    try {
      const [profileRes, balanceRes] = await Promise.all([
        apiFetch<{ user: UserProfile }>("/api/me"),
        apiFetch<{ balances: LeaveBalance[] }>("/api/leave-balance").catch(() => ({ balances: [] })),
      ]);
      setProfile(profileRes.user);
      setName(profileRes.user.name);
      setPhone(profileRes.user.phone ?? "");
      setAddress(profileRes.user.address ?? "");
      setLeaveBalances(balanceRes.balances);
    } catch {
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
  }, [token]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch<{ user: UserProfile }>("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ name, phone: phone || undefined, address: address || undefined }),
      });
      setProfile(res.user);
      setSuccess("Profile updated successfully");
    } catch (e: any) {
      setError(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    setPwError(null);
    setPwSuccess(null);
    if (!currentPassword || !newPassword) {
      setPwError("All fields are required");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPwError("Password must be at least 6 characters");
      return;
    }
    setPwSaving(true);
    try {
      await apiFetch("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPwSuccess("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      setPwError(e?.message ?? "Failed to change password");
    } finally {
      setPwSaving(false);
    }
  };

  const ROLE_COLORS: Record<string, string> = {
    admin: "bg-red-50 text-red-700",
    manager: "bg-blue-50 text-blue-700",
    employee: "bg-emerald-50 text-emerald-700",
  };

  if (loading) {
    return (
      <AppShell>
        <div className="py-16 text-center text-zinc-400">Loading profile…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">My Profile</h1>
        <p className="text-sm text-zinc-500">View and update your personal information</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Personal Information">
            <div className="space-y-4">
              {profile?.photoUrl && (
                <div className="flex items-center gap-4">
                  <img
                    src={profile.photoUrl}
                    alt="Profile"
                    className="h-16 w-16 rounded-full object-cover border border-zinc-200"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Full Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Phone</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Address</label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" />
              </div>

              {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
              {success && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

              <Button onClick={save} disabled={saving || !name.trim()} className="w-full">
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </Card>

          <Card title="Change Password">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Current Password</label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">New Password</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Confirm New Password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                />
              </div>

              {pwError && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{pwError}</div>}
              {pwSuccess && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{pwSuccess}</div>}

              <Button onClick={changePassword} disabled={pwSaving} className="w-full">
                {pwSaving ? "Changing…" : "Change Password"}
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Leave Balance">
            {leaveBalances.filter((b) => b.leaveType !== "unpaid" && b.isSet).length > 0 ? (
              <div className="space-y-3">
                {leaveBalances.filter((b) => b.leaveType !== "unpaid").map((b) => {
                  const total = b.entitlementDays + b.carriedOverDays;
                  const pct = total > 0 ? Math.max(0, Math.min(100, (b.remainingDays / total) * 100)) : 0;
                  return (
                    <div key={b.leaveType}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-zinc-700">{LEAVE_TYPE_LABELS[b.leaveType]}</span>
                        {b.isSet ? (
                          <span className={`text-sm font-semibold ${b.remainingDays > 0 ? "text-emerald-700" : "text-red-700"}`}>
                            {b.remainingDays}d / {total}d
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">Not set</span>
                        )}
                      </div>
                      {b.isSet && (
                        <div className="h-2 w-full rounded-full bg-zinc-100">
                          <div
                            className={`h-2 rounded-full transition-all ${b.remainingDays > 0 ? "bg-emerald-400" : "bg-red-400"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                <p className="text-xs text-zinc-400 mt-1">Year {new Date().getFullYear()}</p>
              </div>
            ) : (
              <p className="text-sm text-zinc-400">No leave balance set. Contact your administrator.</p>
            )}
          </Card>

          <Card title="Account Details">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="font-medium text-zinc-500">Email</dt>
                <dd className="text-zinc-900">{profile?.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-500">Role</dt>
                <dd>
                  <span className={`inline-block rounded-lg px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[profile?.role ?? ""] ?? ""}`}>
                    {profile?.role ?? "—"}
                  </span>
                </dd>
              </div>
              {profile?.employeeId && (
                <div>
                  <dt className="font-medium text-zinc-500">Employee ID</dt>
                  <dd className="text-zinc-900">{profile.employeeId}</dd>
                </div>
              )}
              {profile?.department && (
                <div>
                  <dt className="font-medium text-zinc-500">Department</dt>
                  <dd className="text-zinc-900">{profile.department}</dd>
                </div>
              )}
              {profile?.jobTitle && (
                <div>
                  <dt className="font-medium text-zinc-500">Job Title</dt>
                  <dd className="text-zinc-900">{profile.jobTitle}</dd>
                </div>
              )}
              <div>
                <dt className="font-medium text-zinc-500">Member Since</dt>
                <dd className="text-zinc-900">
                  {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "—"}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
