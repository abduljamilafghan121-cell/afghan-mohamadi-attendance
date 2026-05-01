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

  const hourNow = new Date().getHours();
  const greeting = hourNow < 12 ? "Good morning" : hourNow < 17 ? "Good afternoon" : "Good evening";
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const checkedIn = !!today?.session?.checkInAt;
  const checkedOut = !!today?.session?.checkOutAt;

  const qrDecoded = (() => {
    if (!qrPayload) return null;
    try {
      const p = JSON.parse(qrPayload);
      const office = offices.find((o) => o.id === p.officeId);
      return { ok: true, officeName: office?.name ?? null, purpose: p.purpose ?? null };
    } catch {
      return { ok: false };
    }
  })();

  return (
    <AppShell>
      <div className="space-y-6">

        {/* ── Greeting banner ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white border border-zinc-200 px-5 py-4 shadow-sm">
          <div>
            <div className="text-lg font-semibold text-zinc-900">
              {greeting}{me?.name ? `, ${me.name.split(" ")[0]}` : ""}
            </div>
            <div className="mt-0.5 text-sm text-zinc-500">{todayLabel}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dayStatus?.isHoliday && (
              <span className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-700">
                🏖 Holiday{dayStatus.holidayName ? ` · ${dayStatus.holidayName}` : ""}
              </span>
            )}
            {dayStatus?.isOffDay && !dayStatus.isHoliday && (
              <span className="rounded-full bg-violet-50 border border-violet-200 px-3 py-1 text-xs font-medium text-violet-700">
                📅 Office Off Day
              </span>
            )}
            {checkedOut ? (
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                ✓ Completed · out {new Date(today!.session!.checkOutAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : checkedIn ? (
              <span className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700">
                ● In since {new Date(today!.session!.checkInAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : (
              <span className="rounded-full bg-zinc-100 border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-500">
                Not checked in yet
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">

            {/* ── Check In / Check Out card ── */}
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-zinc-100 px-5 py-4">
                <h2 className="text-base font-semibold text-zinc-900">Attendance Check-In</h2>
                {dayStatus && !dayStatus.isOffDay && !dayStatus.isHoliday && dayStatus.workStartTime && (
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Office hours: <strong>{dayStatus.workStartTime}</strong>
                    {dayStatus.workEndTime && <> – <strong>{dayStatus.workEndTime}</strong></>}
                  </p>
                )}
              </div>

              <div className="p-5 space-y-5">

                {/* Step 1 — Office */}
                {offices.length > 1 && (
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">1</div>
                      <div className="mt-1 flex-1 w-px bg-zinc-200" />
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="mb-1.5 text-sm font-medium text-zinc-800">Select Office</div>
                      <select
                        value={officeId}
                        onChange={(e) => setOfficeId(e.target.value)}
                        className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm focus:bg-white focus:ring-4 focus:ring-zinc-100 transition"
                      >
                        {offices.map((o) => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Step 2 — GPS */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${gps ? "bg-emerald-500" : "bg-zinc-900"}`}>
                      {gps ? "✓" : offices.length > 1 ? "2" : "1"}
                    </div>
                    <div className="mt-1 flex-1 w-px bg-zinc-200" />
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="mb-1.5 text-sm font-medium text-zinc-800">Location</div>
                    {gps ? (
                      <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <div>
                          <div className="text-sm font-semibold text-emerald-800">✓ Location captured</div>
                          <div className="mt-0.5 text-xs text-emerald-600">
                            {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
                            {gps.accuracyM ? ` · ±${Math.round(gps.accuracyM)}m` : ""}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={getLocation}
                          className="text-xs text-emerald-700 hover:underline"
                        >
                          Refresh
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={getLocation}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 py-3.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-white active:scale-[0.98]"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                        </svg>
                        Tap to get GPS location
                      </button>
                    )}
                  </div>
                </div>

                {/* Step 3 — QR */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${qrDecoded?.ok ? "bg-emerald-500" : "bg-zinc-900"}`}>
                      {qrDecoded?.ok ? "✓" : offices.length > 1 ? "3" : "2"}
                    </div>
                    <div className="mt-1 flex-1 w-px bg-zinc-200" />
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="mb-1.5 text-sm font-medium text-zinc-800">Scan QR Code</div>

                    {qrDecoded?.ok ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold text-emerald-800">✓ QR code ready</div>
                            {qrDecoded.officeName && (
                              <div className="mt-0.5 text-xs text-emerald-700">Office: <strong>{qrDecoded.officeName}</strong></div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setQrPayload("")}
                            className="text-xs text-emerald-700 hover:underline"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    ) : qrDecoded && !qrDecoded.ok ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        ⚠ Invalid QR — make sure it was generated by this system.
                        <button type="button" onClick={() => setQrPayload("")} className="ml-2 text-xs underline">Clear</button>
                      </div>
                    ) : null}

                    {scannerError && (
                      <div className="mb-2 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{scannerError}</div>
                    )}

                    {scannerOpen && (
                      <div className="mb-3 overflow-hidden rounded-xl border border-zinc-200 bg-black">
                        <video ref={videoRef} className="aspect-video w-full" playsInline muted />
                        <canvas ref={canvasRef} className="hidden" />
                      </div>
                    )}

                    {!qrDecoded?.ok && (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={scannerOpen ? stopScanner : startScanner}
                          className={`flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3.5 text-sm font-medium transition active:scale-[0.98] ${
                            scannerOpen
                              ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                              : "border-zinc-300 bg-zinc-50 text-zinc-700 hover:border-zinc-400 hover:bg-white"
                          }`}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                          </svg>
                          {scannerOpen ? "Stop camera" : "Scan with camera"}
                        </button>
                        <Textarea
                          value={qrPayload}
                          onChange={(e) => setQrPayload(e.target.value)}
                          rows={2}
                          placeholder="Or paste QR payload manually…"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 4 — Action */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${checkedOut ? "bg-emerald-500" : checkedIn ? "bg-blue-500" : "bg-zinc-900"}`}>
                      {checkedOut ? "✓" : offices.length > 1 ? "4" : "3"}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="mb-3 text-sm font-medium text-zinc-800">Check In / Check Out</div>

                    {/* Day status banners */}
                    {dayStatus && (dayStatus.isOffDay || dayStatus.isHoliday) && (
                      dayStatus.canCheckIn ? (
                        <div className="mb-3 flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
                          <span className="shrink-0 text-lg">⭐</span>
                          <div>
                            <div className="font-medium">Overtime approved — you can work today</div>
                            <div className="mt-0.5 text-xs text-orange-700">
                              Today is {dayStatus.isHoliday ? `a holiday${dayStatus.holidayName ? ` (${dayStatus.holidayName})` : ""}` : "your off day"},
                              but you are scheduled for overtime.
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mb-3 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                          <span className="shrink-0 text-lg">🚫</span>
                          <div>
                            <div className="font-medium">
                              {dayStatus.isHoliday
                                ? `Public holiday${dayStatus.holidayName ? ` · ${dayStatus.holidayName}` : ""}`
                                : "Weekly off day"}
                            </div>
                            <div className="mt-0.5 text-xs text-red-700">Check-in is not available today.</div>
                          </div>
                        </div>
                      )
                    )}

                    {today?.session?.checkInAt && !checkedOut && dayStatus?.workEndTime && (
                      <div className="mb-3 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
                        <span>🕐</span>
                        <span>Shift ends at <strong>{dayStatus.workEndTime}</strong> — remember to check out.</span>
                      </div>
                    )}

                    {/* Feedback messages */}
                    {error && (
                      <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <span>✗</span><span>{error}</span>
                      </div>
                    )}
                    {warning && (
                      <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                        <span>⚠</span><span>{warning}</span>
                      </div>
                    )}
                    {message && (
                      <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                        <span>✓</span><span>{message}</span>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={loading || checkedIn || (dayStatus !== null && !dayStatus.canCheckIn)}
                        onClick={() => doAction("/api/attendance/check-in", "Check-in")}
                        className={`flex h-14 items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed
                          ${checkedIn
                            ? "bg-emerald-500 text-white cursor-default"
                            : "bg-zinc-900 text-white hover:bg-zinc-700 shadow-md shadow-zinc-900/20"
                          }`}
                      >
                        {checkedIn ? (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            {new Date(today!.session!.checkInAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </>
                        ) : loading ? "Checking in…" : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                            Check In
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={loading || !checkedIn || checkedOut || (dayStatus !== null && !dayStatus.canCheckIn)}
                        onClick={() => doAction("/api/attendance/check-out", "Check-out")}
                        className={`flex h-14 items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed
                          ${checkedOut
                            ? "bg-emerald-500 text-white cursor-default"
                            : "border-2 border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50"
                          }`}
                      >
                        {checkedOut ? (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            {new Date(today!.session!.checkOutAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </>
                        ) : loading ? "Checking out…" : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                            Check Out
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* ── Leave Balance ── */}
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-zinc-100 px-5 py-4">
                <h2 className="text-base font-semibold text-zinc-900">Leave Balance</h2>
              </div>
              <div className="p-5">
                {leaveBalances.filter((b) => b.leaveType !== "unpaid").length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {leaveBalances.filter((b) => b.leaveType !== "unpaid").map((b) => {
                      const total = b.entitlementDays + b.carriedOverDays;
                      const pct = total > 0 ? Math.max(0, Math.min(100, (b.remainingDays / total) * 100)) : 0;
                      return (
                        <div key={b.leaveType} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                          <div className="text-[11px] uppercase tracking-wider font-medium text-zinc-400 mb-2">{LEAVE_TYPE_LABELS[b.leaveType]}</div>
                          {b.isSet ? (
                            <>
                              <div className="text-2xl font-bold text-zinc-900">{b.remainingDays}<span className="text-sm font-normal text-zinc-400">d</span></div>
                              <div className="text-xs text-zinc-400 mb-2">of {total} days</div>
                              <div className="h-1.5 w-full rounded-full bg-zinc-200">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${b.remainingDays > 0 ? "bg-emerald-400" : "bg-red-400"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-zinc-400">Not configured</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-zinc-400">No leave balance configured yet. Contact your administrator.</div>
                )}
              </div>
            </div>

            {/* ── Leave Request ── */}
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-zinc-100 px-5 py-4">
                <h2 className="text-base font-semibold text-zinc-900">Apply for Leave</h2>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700">Leave Type</label>
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value as any)}
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm focus:bg-white focus:ring-4 focus:ring-zinc-100 transition"
                  >
                    <option value="annual">Annual Leave</option>
                    <option value="sick">Sick Leave</option>
                    <option value="casual">Casual Leave</option>
                    <option value="unpaid">Unpaid Leave</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-700">Start Date</label>
                    <Input type="date" value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-700">End Date</label>
                    <Input type="date" value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700">Reason <span className="text-zinc-400 font-normal">(optional)</span></label>
                  <Textarea value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} rows={3} placeholder="Briefly describe your reason…" />
                </div>

                {leaveError && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{leaveError}</div>}
                {leaveSuccess && <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">{leaveSuccess}</div>}

                <button
                  type="button"
                  disabled={leaveLoading}
                  onClick={submitLeave}
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-50 active:scale-[0.98]"
                >
                  {leaveLoading ? "Submitting…" : "Submit Leave Request"}
                </button>

                {leaveRows.length > 0 && (
                  <div>
                    <div className="mb-3 text-sm font-medium text-zinc-700">Recent Requests</div>
                    <div className="space-y-2">
                      {leaveRows.slice(0, 5).map((r) => (
                        <div key={r.id} className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-medium ${LEAVE_TYPE_COLORS[r.leaveType] ?? "bg-zinc-100 text-zinc-600"}`}>
                              {LEAVE_TYPE_LABELS[r.leaveType] ?? r.leaveType}
                            </span>
                            <span className="truncate text-zinc-700">{fmtDate(r.startDate)} — {fmtDate(r.endDate)}</span>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            r.status === "approved" ? "bg-emerald-50 text-emerald-700" :
                            r.status === "rejected" ? "bg-red-50 text-red-700" :
                            "bg-amber-50 text-amber-700"
                          }`}>
                            {r.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-5">

            {/* Profile card */}
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-zinc-100 px-5 py-4">
                <h2 className="text-base font-semibold text-zinc-900">My Profile</h2>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
                    {me?.photoUrl ? (
                      <>
                        <button type="button" onClick={() => setPhotoExpanded(true)} className="h-full w-full focus:outline-none">
                          <img src={me.photoUrl} alt="Profile" className="h-full w-full object-cover hover:opacity-90 transition-opacity cursor-pointer" />
                        </button>
                        {photoExpanded && (
                          <button type="button" onClick={() => setPhotoExpanded(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm w-full focus:outline-none">
                            <img src={me.photoUrl} alt="Profile" className="h-64 w-64 rounded-2xl object-cover shadow-2xl border-4 border-white" />
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl text-zinc-300">
                        {me?.name ? me.name.charAt(0).toUpperCase() : "?"}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-zinc-900 truncate">{me?.name ?? "—"}</div>
                    <div className="text-xs text-zinc-500 truncate">{me?.jobTitle ?? me?.department ?? ""}</div>
                    <div className="text-xs text-zinc-400 truncate">{me?.email ?? ""}</div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {[
                    { label: "Employee ID", value: me?.employeeId },
                    { label: "Department", value: me?.department },
                    { label: "Phone", value: me?.phone },
                    { label: "Role", value: user?.role },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2">
                      <span className="text-zinc-500 text-xs">{label}</span>
                      <span className="font-medium text-zinc-800 text-xs text-right">{value ?? "—"}</span>
                    </div>
                  ))}
                </div>

                <a
                  href="/profile"
                  className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
                >
                  Edit Profile
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="6,3 11,8 6,13" /></svg>
                </a>
              </div>
            </div>

            {/* Today's session summary */}
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-zinc-100 px-5 py-4">
                <h2 className="text-base font-semibold text-zinc-900">Today's Session</h2>
              </div>
              <div className="divide-y divide-zinc-100 text-sm">
                {[
                  { label: "Check-in", value: today?.session?.checkInAt ? new Date(today.session.checkInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—" },
                  { label: "Check-out", value: today?.session?.checkOutAt ? new Date(today.session.checkOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—" },
                  { label: "Office", value: today?.session?.office?.name ?? "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between px-5 py-3">
                    <span className="text-zinc-500">{label}</span>
                    <span className="font-medium text-zinc-800">{value}</span>
                  </div>
                ))}
              </div>
              <div className="px-5 pb-4 pt-3">
                <a
                  href="/employee/history"
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
                >
                  View Full History
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="6,3 11,8 6,13" /></svg>
                </a>
              </div>
            </div>

          </div>
        </div>
      </div>
    </AppShell>
  );
}
