"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../components/AppShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { Input } from "../../components/ui/Input";
import { apiFetch } from "../../lib/clientApi";
import { getToken, parseJwt, JwtUser } from "../../lib/clientAuth";

type TodaySession = {
  id: string;
  workDate: string;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  office: { id: string; name: string; timezone: string };
};

type DayStatus = {
  isOffDay: boolean;
  isHoliday: boolean;
  holidayName: string | null;
  hasOverride: boolean;
  canCheckIn: boolean;
  workStartTime: string | null;
  workEndTime: string | null;
};

type MeUser = {
  id: string;
  name: string;
  email: string | null;
  role: "employee" | "manager" | "admin";
  employeeId: string | null;
  phone: string | null;
  department: string | null;
  jobTitle: string | null;
  address: string | null;
  photoUrl: string | null;
};

type Office = {
  id: string;
  name: string;
  gpsLat: number;
  gpsLng: number;
  gpsRadiusM: number;
  timezone: string;
};

type LeaveRow = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  leaveType: "annual" | "sick" | "casual" | "unpaid";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  decidedAt: string | null;
  decidedById: string | null;
};

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

const LEAVE_TYPE_COLORS: Record<string, string> = {
  annual: "bg-blue-50 text-blue-700",
  sick: "bg-red-50 text-red-700",
  casual: "bg-amber-50 text-amber-700",
  unpaid: "bg-zinc-50 text-zinc-700",
};

function toDateInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return d;
  }
}

export default function EmployeePage() {
  const router = useRouter();
  const [offices, setOffices] = useState<Office[]>([]);
  const [officeId, setOfficeId] = useState<string>("");
  const [qrPayload, setQrPayload] = useState<string>("");
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracyM?: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [leaveStart, setLeaveStart] = useState(() => toDateInputValue(new Date()));
  const [leaveEnd, setLeaveEnd] = useState(() => toDateInputValue(new Date()));
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveType, setLeaveType] = useState<"annual" | "sick" | "casual" | "unpaid">("annual");
  const [leaveRows, setLeaveRows] = useState<LeaveRow[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaveSuccess, setLeaveSuccess] = useState<string | null>(null);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);

  const [today, setToday] = useState<{ session: TodaySession | null } | null>(null);
  const [dayStatus, setDayStatus] = useState<DayStatus | null>(null);
  const [me, setMe] = useState<MeUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<JwtUser | null>(null);
  const [photoExpanded, setPhotoExpanded] = useState(false);

  useEffect(() => {
    const t = getToken();
    setToken(t);
    setUser(t ? parseJwt(t) : null);
    if (!t) router.push("/login");
  }, [router]);

  useEffect(() => {
    return () => {
      if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{ offices: Office[] }>("/api/offices");
        setOffices(res.offices);
        if (res.offices.length > 0) setOfficeId(res.offices[0].id);
      } catch {
        setOffices([]);
      }
    })();
  }, []);

  const loadToday = async () => {
    const qs = new URLSearchParams();
    if (officeId.trim()) qs.set("officeId", officeId.trim());
    const res = await apiFetch<{ sessions: TodaySession[] }>(`/api/attendance/today?${qs.toString()}`);
    setToday({ session: res.sessions?.[0] ?? null });
  };

  const loadDayStatus = async (oId: string) => {
    if (!oId) return;
    try {
      const res = await apiFetch<DayStatus>(`/api/attendance/day-status?officeId=${oId}`);
      setDayStatus(res);
    } catch {
      setDayStatus(null);
    }
  };

  const loadMe = async () => {
    const res = await apiFetch<{ user: MeUser }>("/api/me");
    setMe(res.user);
  };

  const loadLeaves = async () => {
    const res = await apiFetch<{ leaves: LeaveRow[] }>("/api/leave");
    setLeaveRows(res.leaves);
  };

  const loadBalances = async () => {
    try {
      const res = await apiFetch<{ balances: LeaveBalance[] }>("/api/leave-balance");
      setLeaveBalances(res.balances);
    } catch {
      setLeaveBalances([]);
    }
  };

  const applyScannedQr = (raw: string) => {
    const trimmed = raw.trim();
    setQrPayload(trimmed);
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.officeId && typeof parsed.officeId === "string") {
        setOfficeId(parsed.officeId);
      }
    } catch {
      // not valid JSON — still set it so user sees what was read
    }
  };

  const stopScanner = () => {
    if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
    scanTimerRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScannerOpen(false);
  };

  const startScanner = async () => {
    setScannerError(null);
    setError(null);
    setMessage(null);
    setWarning(null);

    const anyWindow = window as any;
    const hasBarcodeDetector = Boolean(anyWindow.BarcodeDetector);

    const waitForVideoElement = async () => {
      for (let i = 0; i < 30; i++) {
        if (videoRef.current) return videoRef.current;
        await new Promise((r) => setTimeout(r, 25));
      }
      return null;
    };

    const waitForVideoReady = async (video: HTMLVideoElement) => {
      if (video.readyState >= 2 && video.videoWidth > 0) return;
      await new Promise<void>((resolve) => {
        const onReady = () => {
          cleanup();
          resolve();
        };
        const cleanup = () => {
          video.removeEventListener("loadedmetadata", onReady);
          video.removeEventListener("canplay", onReady);
        };
        video.addEventListener("loadedmetadata", onReady);
        video.addEventListener("canplay", onReady);
        setTimeout(() => {
          cleanup();
          resolve();
        }, 2000);
      });
    };

    try {
      setScannerOpen(true);
      const video = await waitForVideoElement();
      if (!video) throw new Error("Video not ready");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      await waitForVideoReady(video);

      if (hasBarcodeDetector) {
        const detector = new anyWindow.BarcodeDetector({ formats: ["qr_code"] });
        if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
        scanTimerRef.current = window.setInterval(async () => {
          const v = videoRef.current;
          const c = canvasRef.current;
          if (!v || !c) return;
          if (v.readyState < 2) return;

          const w = v.videoWidth;
          const h = v.videoHeight;
          if (!w || !h) return;

          c.width = w;
          c.height = h;
          const ctx = c.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(v, 0, 0, w, h);

          try {
            const codes = await detector.detect(c);
            const raw = codes?.[0]?.rawValue;
            if (raw && typeof raw === "string") {
              applyScannedQr(raw);
              stopScanner();
              setMessage("QR scanned successfully.");
            }
          } catch {
            // ignore detection errors
          }
        }, 250);
      } else {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader();
        const result = await reader.decodeOnceFromVideoElement(video);
        const text = result?.getText?.();
        if (text) {
          applyScannedQr(text);
          stopScanner();
          setMessage("QR scanned successfully.");
        }
      }
    } catch (e: any) {
      stopScanner();
      setScannerError(e?.message ?? "Failed to start camera");
    }
  };

  useEffect(() => {
    if (!token) return;
    loadToday().catch(() => setToday({ session: null }));
    loadMe().catch(() => setMe(null));
    loadLeaves().catch(() => setLeaveRows([]));
    loadBalances();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (!officeId.trim()) return;
    loadToday().catch(() => setToday({ session: null }));
    loadDayStatus(officeId).catch(() => setDayStatus(null));
  }, [officeId, token]);

  const submitLeave = async () => {
    setLeaveLoading(true);
    setLeaveError(null);
    setLeaveSuccess(null);
    try {
      await apiFetch("/api/leave", {
        method: "POST",
        body: JSON.stringify({
          startDate: leaveStart,
          endDate: leaveEnd,
          reason: leaveReason.trim() ? leaveReason.trim() : undefined,
          leaveType,
        }),
      });
      setLeaveReason("");
      setLeaveSuccess("Leave request submitted.");
      await loadLeaves();
      await loadBalances();
    } catch (e: any) {
      setLeaveError(e?.message ?? "Failed");
    } finally {
      setLeaveLoading(false);
    }
  };

  const getLocation = async () => {
    setError(null);
    setMessage(null);
    setWarning(null);
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        });
        setMessage("GPS captured.");
      },
      () => setError("Please allow location access to check in/out"),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const doAction = async (path: string, actionLabel: string) => {
    setLoading(true);
    setError(null);
    setMessage(null);
    setWarning(null);
    try {
      if (!gps) throw new Error("Capture GPS first");
      const trimmedPayload = qrPayload.trim();
      if (!trimmedPayload) throw new Error("Scan or paste a QR payload first");

      let resolvedOfficeId = officeId;
      try {
        const parsed = JSON.parse(trimmedPayload);
        if (parsed?.officeId && typeof parsed.officeId === "string") {
          resolvedOfficeId = parsed.officeId;
        }
      } catch {
        // payload is not JSON — server will reject it
      }
      if (!resolvedOfficeId) throw new Error("Select an office");

      const result = await apiFetch<any>(path, {
        method: "POST",
        body: JSON.stringify({ officeId: resolvedOfficeId, qrPayload: trimmedPayload, gps }),
      });
      const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      if (result?.isLateArrival && result?.minutesLate) {
        setWarning(
          `Checked in at ${time} — you arrived ${result.minutesLate} minute${result.minutesLate !== 1 ? "s" : ""} late. This has been recorded.`
        );
      } else if (result?.isEarlyDeparture && result?.minutesEarlyDeparture) {
        setWarning(
          `Checked out at ${time} — you left ${result.minutesEarlyDeparture} minute${result.minutesEarlyDeparture !== 1 ? "s" : ""} before end of shift. This has been recorded.`
        );
      } else {
        setMessage(`${actionLabel} successful at ${time}.`);
      }
      await loadToday();
    } catch (err: any) {
      setError(err?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Check In / Check Out">
            <div className="grid gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-800">Office</label>
                <select
                  value={officeId}
                  onChange={(e) => setOfficeId(e.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm focus:ring-4 focus:ring-zinc-100"
                >
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-zinc-800">GPS</div>
                  <Button variant="secondary" type="button" onClick={getLocation}>
                    Get GPS
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={gps?.lat ?? ""} readOnly placeholder="Latitude" />
                  <Input value={gps?.lng ?? ""} readOnly placeholder="Longitude" />
                </div>
                <div className="text-xs text-zinc-500">You must be inside the office radius.</div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-800">QR Payload</label>
                <div className="mb-2 flex flex-wrap gap-2">
                  {!scannerOpen ? (
                    <Button variant="secondary" type="button" onClick={startScanner}>
                      Scan with camera
                    </Button>
                  ) : (
                    <Button variant="secondary" type="button" onClick={stopScanner}>
                      Stop camera
                    </Button>
                  )}
                </div>

                {scannerError ? (
                  <div className="mb-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">{scannerError}</div>
                ) : null}

                {scannerOpen ? (
                  <div className="mb-2 overflow-hidden rounded-xl border border-zinc-200 bg-black">
                    <video ref={videoRef} className="aspect-video w-full" playsInline muted />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                ) : null}

                <Textarea
                  value={qrPayload}
                  onChange={(e) => setQrPayload(e.target.value)}
                  rows={3}
                  placeholder="QR payload will appear here after scanning, or paste it manually."
                />
                {qrPayload ? (
                  <div className="mt-2 space-y-1">
                    {(() => {
                      try {
                        const p = JSON.parse(qrPayload);
                        const office = offices.find((o) => o.id === p.officeId);
                        return (
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                            <div className="font-medium mb-0.5">✓ QR decoded</div>
                            {office && <div>Office: <strong>{office.name}</strong></div>}
                            {p.purpose && <div>Purpose: <strong>{p.purpose.replace("_", "-")}</strong></div>}
                          </div>
                        );
                      } catch {
                        return (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            ⚠ Could not decode QR — make sure it was generated by this system.
                          </div>
                        );
                      }
                    })()}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">QR payload loaded</span>
                      <button
                        type="button"
                        onClick={() => setQrPayload("")}
                        className="text-xs text-zinc-400 hover:text-zinc-600"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-zinc-400">
                    Use the camera button to scan, or paste the QR payload manually.
                  </div>
                )}
              </div>

              {dayStatus && (dayStatus.isOffDay || dayStatus.isHoliday) && (
                dayStatus.canCheckIn ? (
                  <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
                    <span className="mt-0.5 shrink-0 text-lg">⚠</span>
                    <div>
                      <div className="font-medium">
                        {dayStatus.isHoliday
                          ? `Today is a public holiday${dayStatus.holidayName ? `: ${dayStatus.holidayName}` : ""}`
                          : "Today is your day off"}
                      </div>
                      <div className="mt-0.5 text-xs text-orange-700">
                        You have been scheduled to work today. This session will be marked as <strong>overtime</strong>.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    <span className="mt-0.5 shrink-0 text-lg">🚫</span>
                    <div>
                      <div className="font-medium">
                        {dayStatus.isHoliday
                          ? `Today is a public holiday${dayStatus.holidayName ? `: ${dayStatus.holidayName}` : ""}`
                          : "Today is your day off"}
                      </div>
                      <div className="mt-0.5 text-xs text-red-700">
                        Check-in is not allowed today. If you need to work, contact your administrator.
                      </div>
                    </div>
                  </div>
                )
              )}

              {dayStatus && !dayStatus.isOffDay && !dayStatus.isHoliday && dayStatus.workStartTime && (
                <div className="rounded-xl bg-zinc-50 px-4 py-2 text-xs text-zinc-500">
                  Office hours: <strong>{dayStatus.workStartTime}</strong>
                  {dayStatus.workEndTime && <> – <strong>{dayStatus.workEndTime}</strong></>}
                  {" "}· Check in late and it will be flagged.
                </div>
              )}

              {today?.session?.checkInAt && !today?.session?.checkOutAt && dayStatus?.workEndTime && (
                <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-700">
                  <span>🕐</span>
                  <span>Shift ends at <strong>{dayStatus.workEndTime}</strong> — check out before then to avoid an early-departure flag.</span>
                </div>
              )}

              {error ? (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <span className="mt-0.5 shrink-0 text-base">✗</span>
                  <span>{error}</span>
                </div>
              ) : null}
              {warning ? (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <span className="mt-0.5 shrink-0 text-base">⚠</span>
                  <span className="font-medium">{warning}</span>
                </div>
              ) : null}
              {message ? (
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <span className="mt-0.5 shrink-0 text-base">✓</span>
                  <span className="font-medium">{message}</span>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <Button
                  disabled={loading || !!today?.session?.checkInAt || (dayStatus !== null && !dayStatus.canCheckIn)}
                  variant={today?.session?.checkInAt ? "success" : "primary"}
                  onClick={() => doAction("/api/attendance/check-in", "Check-in")}
                >
                  {today?.session?.checkInAt
                    ? `Checked In ✓ ${new Date(today.session.checkInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                    : loading ? "Checking in…" : "Check In"}
                </Button>
                <Button
                  disabled={loading || !today?.session?.checkInAt || !!today?.session?.checkOutAt || (dayStatus !== null && !dayStatus.canCheckIn)}
                  variant={today?.session?.checkOutAt ? "success" : "secondary"}
                  onClick={() => doAction("/api/attendance/check-out", "Check-out")}
                >
                  {today?.session?.checkOutAt
                    ? `Checked Out ✓ ${new Date(today.session.checkOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                    : loading ? "Checking out…" : "Check Out"}
                </Button>
              </div>
            </div>
          </Card>

          <Card title="Leave Balance">
            {leaveBalances.filter((b) => b.leaveType !== "unpaid").length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {leaveBalances.filter((b) => b.leaveType !== "unpaid").map((b) => {
                  const total = b.entitlementDays + b.carriedOverDays;
                  const pct = total > 0 ? Math.max(0, Math.min(100, (b.remainingDays / total) * 100)) : 0;
                  return (
                    <div key={b.leaveType} className="rounded-xl border border-zinc-200 bg-white p-3">
                      <div className="text-xs font-medium text-zinc-500 mb-1">{LEAVE_TYPE_LABELS[b.leaveType]}</div>
                      {b.isSet ? (
                        <>
                          <div className="text-lg font-bold text-zinc-900">{b.remainingDays}d</div>
                          <div className="text-xs text-zinc-400">of {total}d</div>
                          <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-100">
                            <div
                              className={`h-1.5 rounded-full ${b.remainingDays > 0 ? "bg-emerald-400" : "bg-red-400"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-zinc-400 mt-1">Not set</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-zinc-400">No leave balance configured yet. Contact your administrator.</div>
            )}
          </Card>

          <Card title="Leave Request">
            <div className="grid gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-800">Leave Type</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as any)}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm focus:ring-4 focus:ring-zinc-100"
                >
                  <option value="annual">Annual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="casual">Casual Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-800">Start</label>
                  <Input type="date" value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-800">End</label>
                  <Input type="date" value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-800">Reason (optional)</label>
                <Textarea value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} rows={3} placeholder="Reason" />
              </div>

              {leaveError ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{leaveError}</div> : null}
              {leaveSuccess ? (
                <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{leaveSuccess}</div>
              ) : null}

              <Button disabled={leaveLoading} onClick={submitLeave}>
                {leaveLoading ? "Submitting..." : "Submit request"}
              </Button>

              <div className="mt-2">
                <div className="mb-2 text-sm font-medium text-zinc-800">Your requests</div>
                <div className="space-y-2">
                  {leaveRows.slice(0, 5).map((r) => (
                    <div key={r.id} className="rounded-xl border border-zinc-200 bg-white p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${LEAVE_TYPE_COLORS[r.leaveType] ?? "bg-zinc-50 text-zinc-700"}`}>
                            {LEAVE_TYPE_LABELS[r.leaveType] ?? r.leaveType}
                          </span>
                          <div className="text-zinc-900">
                            {fmtDate(r.startDate)} — {fmtDate(r.endDate)}
                          </div>
                        </div>
                        <span className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700">
                          {r.status}
                        </span>
                      </div>
                      {r.reason ? <div className="mt-1 text-xs text-zinc-500">{r.reason}</div> : null}
                    </div>
                  ))}
                  {leaveRows.length === 0 ? <div className="text-xs text-zinc-500">No leave requests yet.</div> : null}
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Your Profile">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                {me?.photoUrl ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setPhotoExpanded(true)}
                      className="h-full w-full focus:outline-none"
                    >
                      <img src={me.photoUrl} alt="Profile" className="h-full w-full object-cover hover:opacity-90 transition-opacity cursor-pointer" />
                    </button>
                    {photoExpanded && (
                      <button
                        type="button"
                        onClick={() => setPhotoExpanded(false)}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm w-full focus:outline-none"
                      >
                        <img
                          src={me.photoUrl}
                          alt="Profile"
                          className="h-64 w-64 rounded-2xl object-cover shadow-2xl border-4 border-white"
                        />
                      </button>
                    )}
                  </>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">No photo</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-zinc-900">{me?.name ?? "-"}</div>
                <div className="truncate text-xs text-zinc-500">{me?.email ?? ""}</div>
              </div>
            </div>

            <div className="mt-4 text-sm text-zinc-700">
              <div className="flex justify-between">
                <span className="text-zinc-500">Employee ID</span>
                <span className="font-medium">{me?.employeeId ?? "-"}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="text-zinc-500">Phone</span>
                <span className="font-medium">{me?.phone ?? "-"}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="text-zinc-500">Department</span>
                <span className="font-medium">{me?.department ?? "-"}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="text-zinc-500">Job title</span>
                <span className="font-medium">{me?.jobTitle ?? "-"}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="text-zinc-500">Address</span>
                <span className="ml-4 text-right font-medium">{me?.address ?? "-"}</span>
              </div>
            </div>
          </Card>

          <Card title="Your Session">
            <div className="text-sm text-zinc-700">
              <div className="flex justify-between">
                <span className="text-zinc-500">Role</span>
                <span className="font-medium">{user?.role ?? "-"}</span>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Today check-in</span>
                  <span className="font-medium">{today?.session?.checkInAt ? new Date(today.session.checkInAt).toLocaleTimeString() : "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Today check-out</span>
                  <span className="font-medium">{today?.session?.checkOutAt ? new Date(today.session.checkOutAt).toLocaleTimeString() : "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Office</span>
                  <span className="font-medium">{today?.session?.office?.name ?? "-"}</span>
                </div>
              </div>

              <div className="mt-2 text-xs text-zinc-500">
                Backend enforces GPS + QR expiry for both check-in and check-out.
              </div>
            </div>
          </Card>

          <Card title="Tips">
            <div className="space-y-2 text-sm text-zinc-700">
              <div>1) Choose your office</div>
              <div>2) Tap <strong>Get GPS</strong> — allow location</div>
              <div>3) Tap <strong>Scan with camera</strong> and point at the QR code — or paste the payload manually</div>
              <div>4) Tap <strong>Check In</strong> or <strong>Check Out</strong></div>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
