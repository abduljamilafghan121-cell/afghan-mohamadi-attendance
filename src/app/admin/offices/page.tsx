"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/AppShell";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { apiFetch } from "../../../lib/clientApi";
import { getToken, parseJwt } from "../../../lib/clientAuth";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TIMEZONE_OPTIONS = [
  { label: "UTC (UTC+0)", value: "UTC" },
  { label: "GMT (UTC+0)", value: "GMT" },
  // Africa
  { label: "Africa/Cairo (UTC+2)", value: "Africa/Cairo" },
  { label: "Africa/Johannesburg (UTC+2)", value: "Africa/Johannesburg" },
  { label: "Africa/Lagos (UTC+1)", value: "Africa/Lagos" },
  { label: "Africa/Nairobi (UTC+3)", value: "Africa/Nairobi" },
  { label: "Africa/Tunis (UTC+1)", value: "Africa/Tunis" },
  // Americas
  { label: "America/Anchorage (UTC−9)", value: "America/Anchorage" },
  { label: "America/Argentina/Buenos_Aires (UTC−3)", value: "America/Argentina/Buenos_Aires" },
  { label: "America/Bogota (UTC−5)", value: "America/Bogota" },
  { label: "America/Chicago (UTC−6)", value: "America/Chicago" },
  { label: "America/Denver (UTC−7)", value: "America/Denver" },
  { label: "America/Halifax (UTC−4)", value: "America/Halifax" },
  { label: "America/Los_Angeles (UTC−8)", value: "America/Los_Angeles" },
  { label: "America/Mexico_City (UTC−6)", value: "America/Mexico_City" },
  { label: "America/New_York (UTC−5)", value: "America/New_York" },
  { label: "America/Phoenix (UTC−7)", value: "America/Phoenix" },
  { label: "America/Sao_Paulo (UTC−3)", value: "America/Sao_Paulo" },
  { label: "America/Toronto (UTC−5)", value: "America/Toronto" },
  { label: "America/Vancouver (UTC−8)", value: "America/Vancouver" },
  // Asia
  { label: "Asia/Almaty (UTC+6)", value: "Asia/Almaty" },
  { label: "Asia/Baghdad (UTC+3)", value: "Asia/Baghdad" },
  { label: "Asia/Baku (UTC+4)", value: "Asia/Baku" },
  { label: "Asia/Bangkok (UTC+7)", value: "Asia/Bangkok" },
  { label: "Asia/Colombo (UTC+5:30)", value: "Asia/Colombo" },
  { label: "Asia/Dhaka (UTC+6)", value: "Asia/Dhaka" },
  { label: "Asia/Dubai (UTC+4)", value: "Asia/Dubai" },
  { label: "Asia/Ho_Chi_Minh (UTC+7)", value: "Asia/Ho_Chi_Minh" },
  { label: "Asia/Hong_Kong (UTC+8)", value: "Asia/Hong_Kong" },
  { label: "Asia/Jakarta (UTC+7)", value: "Asia/Jakarta" },
  { label: "Asia/Jerusalem (UTC+2)", value: "Asia/Jerusalem" },
  { label: "Asia/Kabul (UTC+4:30)", value: "Asia/Kabul" },
  { label: "Asia/Karachi (UTC+5)", value: "Asia/Karachi" },
  { label: "Asia/Kathmandu (UTC+5:45)", value: "Asia/Kathmandu" },
  { label: "Asia/Kolkata (UTC+5:30)", value: "Asia/Kolkata" },
  { label: "Asia/Kuala_Lumpur (UTC+8)", value: "Asia/Kuala_Lumpur" },
  { label: "Asia/Kuwait (UTC+3)", value: "Asia/Kuwait" },
  { label: "Asia/Manila (UTC+8)", value: "Asia/Manila" },
  { label: "Asia/Muscat (UTC+4)", value: "Asia/Muscat" },
  { label: "Asia/Nicosia (UTC+2)", value: "Asia/Nicosia" },
  { label: "Asia/Qatar (UTC+3)", value: "Asia/Qatar" },
  { label: "Asia/Riyadh (UTC+3)", value: "Asia/Riyadh" },
  { label: "Asia/Seoul (UTC+9)", value: "Asia/Seoul" },
  { label: "Asia/Shanghai (UTC+8)", value: "Asia/Shanghai" },
  { label: "Asia/Singapore (UTC+8)", value: "Asia/Singapore" },
  { label: "Asia/Taipei (UTC+8)", value: "Asia/Taipei" },
  { label: "Asia/Tashkent (UTC+5)", value: "Asia/Tashkent" },
  { label: "Asia/Tehran (UTC+3:30)", value: "Asia/Tehran" },
  { label: "Asia/Tokyo (UTC+9)", value: "Asia/Tokyo" },
  { label: "Asia/Yerevan (UTC+4)", value: "Asia/Yerevan" },
  // Atlantic
  { label: "Atlantic/Azores (UTC−1)", value: "Atlantic/Azores" },
  // Australia
  { label: "Australia/Adelaide (UTC+9:30)", value: "Australia/Adelaide" },
  { label: "Australia/Brisbane (UTC+10)", value: "Australia/Brisbane" },
  { label: "Australia/Melbourne (UTC+11)", value: "Australia/Melbourne" },
  { label: "Australia/Perth (UTC+8)", value: "Australia/Perth" },
  { label: "Australia/Sydney (UTC+11)", value: "Australia/Sydney" },
  // Europe
  { label: "Europe/Amsterdam (UTC+1)", value: "Europe/Amsterdam" },
  { label: "Europe/Athens (UTC+2)", value: "Europe/Athens" },
  { label: "Europe/Belgrade (UTC+1)", value: "Europe/Belgrade" },
  { label: "Europe/Berlin (UTC+1)", value: "Europe/Berlin" },
  { label: "Europe/Brussels (UTC+1)", value: "Europe/Brussels" },
  { label: "Europe/Bucharest (UTC+2)", value: "Europe/Bucharest" },
  { label: "Europe/Budapest (UTC+1)", value: "Europe/Budapest" },
  { label: "Europe/Copenhagen (UTC+1)", value: "Europe/Copenhagen" },
  { label: "Europe/Dublin (UTC+0)", value: "Europe/Dublin" },
  { label: "Europe/Helsinki (UTC+2)", value: "Europe/Helsinki" },
  { label: "Europe/Istanbul (UTC+3)", value: "Europe/Istanbul" },
  { label: "Europe/Kiev (UTC+2)", value: "Europe/Kiev" },
  { label: "Europe/Lisbon (UTC+0)", value: "Europe/Lisbon" },
  { label: "Europe/London (UTC+0)", value: "Europe/London" },
  { label: "Europe/Madrid (UTC+1)", value: "Europe/Madrid" },
  { label: "Europe/Minsk (UTC+3)", value: "Europe/Minsk" },
  { label: "Europe/Moscow (UTC+3)", value: "Europe/Moscow" },
  { label: "Europe/Oslo (UTC+1)", value: "Europe/Oslo" },
  { label: "Europe/Paris (UTC+1)", value: "Europe/Paris" },
  { label: "Europe/Prague (UTC+1)", value: "Europe/Prague" },
  { label: "Europe/Rome (UTC+1)", value: "Europe/Rome" },
  { label: "Europe/Sofia (UTC+2)", value: "Europe/Sofia" },
  { label: "Europe/Stockholm (UTC+1)", value: "Europe/Stockholm" },
  { label: "Europe/Warsaw (UTC+1)", value: "Europe/Warsaw" },
  { label: "Europe/Zurich (UTC+1)", value: "Europe/Zurich" },
  // Pacific
  { label: "Pacific/Auckland (UTC+13)", value: "Pacific/Auckland" },
  { label: "Pacific/Fiji (UTC+12)", value: "Pacific/Fiji" },
  { label: "Pacific/Honolulu (UTC−10)", value: "Pacific/Honolulu" },
];

function TimezoneSelect({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-4 focus:ring-zinc-100 ${className ?? ""}`}
    >
      {TIMEZONE_OPTIONS.map((tz) => (
        <option key={tz.value} value={tz.value}>{tz.label}</option>
      ))}
    </select>
  );
}

type Office = {
  id: string;
  name: string;
  gpsLat: number;
  gpsLng: number;
  gpsRadiusM: number;
  timezone: string;
  isActive: boolean;
  weeklyOffDays: number[];
  workStartTime: string | null;
  workEndTime: string | null;
};

type EditForm = {
  name: string;
  gpsLat: string;
  gpsLng: string;
  gpsRadiusM: string;
  timezone: string;
  weeklyOffDays: number[];
  workStartTime: string;
  workEndTime: string;
};

function OffDayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {DAY_LABELS.map((label, i) => (
        <button
          key={i}
          type="button"
          onClick={() => {
            if (value.includes(i)) onChange(value.filter((d) => d !== i));
            else onChange([...value, i].sort());
          }}
          className={`rounded-lg px-2 py-1 text-xs font-medium border transition-colors ${value.includes(i) ? "bg-zinc-800 text-white border-zinc-800" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function AdminOfficesPage() {
  const router = useRouter();
  const token = typeof window !== "undefined" ? getToken() : null;
  const user = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const [offices, setOffices] = useState<Office[]>([]);
  const [name, setName] = useState("Main Office");
  const [gpsLat, setGpsLat] = useState("0");
  const [gpsLng, setGpsLng] = useState("0");
  const [gpsRadiusM, setGpsRadiusM] = useState("100");
  const [timezone, setTimezone] = useState("UTC");
  const [weeklyOffDays, setWeeklyOffDays] = useState<number[]>([5]);
  const [workStartTime, setWorkStartTime] = useState("");
  const [workEndTime, setWorkEndTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "", gpsLat: "", gpsLng: "", gpsRadiusM: "", timezone: "",
    weeklyOffDays: [5], workStartTime: "", workEndTime: "",
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.push("/login");
    if (user && user.role !== "admin") router.push("/employee");
  }, [token, user, router]);

  const load = async () => {
    const res = await apiFetch<{ offices: Office[] }>("/api/offices?all=true");
    setOffices(res.offices);
  };

  useEffect(() => {
    load().catch(() => setOffices([]));
  }, []);

  const createOffice = async () => {
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/offices", {
        method: "POST",
        body: JSON.stringify({
          name,
          gpsLat: Number(gpsLat),
          gpsLng: Number(gpsLng),
          gpsRadiusM: Number(gpsRadiusM),
          timezone,
          weeklyOffDays,
          workStartTime: workStartTime || undefined,
          workEndTime: workEndTime || undefined,
        }),
      });
      await load();
      setName("Main Office");
      setGpsLat("0");
      setGpsLng("0");
      setGpsRadiusM("100");
      setTimezone("UTC");
      setWeeklyOffDays([5]);
      setWorkStartTime("");
      setWorkEndTime("");
    } catch (err: any) {
      setError(err?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (o: Office) => {
    setEditTarget(o.id);
    setEditForm({
      name: o.name,
      gpsLat: String(o.gpsLat),
      gpsLng: String(o.gpsLng),
      gpsRadiusM: String(o.gpsRadiusM),
      timezone: o.timezone,
      weeklyOffDays: o.weeklyOffDays ?? [5],
      workStartTime: o.workStartTime ?? "",
      workEndTime: o.workEndTime ?? "",
    });
    setEditError(null);
  };

  const saveEdit = async (id: string) => {
    setEditLoading(true);
    setEditError(null);
    try {
      await apiFetch(`/api/offices/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name,
          gpsLat: Number(editForm.gpsLat),
          gpsLng: Number(editForm.gpsLng),
          gpsRadiusM: Number(editForm.gpsRadiusM),
          timezone: editForm.timezone,
          weeklyOffDays: editForm.weeklyOffDays,
          workStartTime: editForm.workStartTime || null,
          workEndTime: editForm.workEndTime || null,
        }),
      });
      setEditTarget(null);
      await load();
    } catch (err: any) {
      setEditError(err?.message ?? "Failed to save");
    } finally {
      setEditLoading(false);
    }
  };

  const deactivate = async (id: string) => {
    if (!confirm("Deactivate this office? Employees will no longer be able to check in here.")) return;
    try {
      await apiFetch(`/api/offices/${id}`, { method: "DELETE" });
      await load();
    } catch (err: any) {
      alert(err?.message ?? "Failed to deactivate");
    }
  };

  const reactivate = async (id: string) => {
    try {
      await apiFetch(`/api/offices/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: true }),
      });
      await load();
    } catch (err: any) {
      alert(err?.message ?? "Failed to reactivate");
    }
  };

  const fillFromBrowser = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setGpsLat(String(pos.coords.latitude));
      setGpsLng(String(pos.coords.longitude));
    });
  };

  const activeOffices = offices.filter((o) => o.isActive);
  const inactiveOffices = offices.filter((o) => !o.isActive);

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card title={`Active Offices (${activeOffices.length})`}>
            <div className="space-y-3">
              {activeOffices.length === 0 ? (
                <div className="text-sm text-zinc-500">No active offices yet.</div>
              ) : (
                activeOffices.map((o) => (
                  <div key={o.id} className="rounded-xl border border-zinc-200 p-4">
                    {editTarget === o.id ? (
                      <div className="space-y-3">
                        <div className="text-sm font-medium text-zinc-700 mb-1">Editing: {o.name}</div>
                        <div>
                          <label className="mb-1 block text-xs text-zinc-600">Name</label>
                          <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="mb-1 block text-xs text-zinc-600">Latitude</label>
                            <Input value={editForm.gpsLat} onChange={(e) => setEditForm({ ...editForm, gpsLat: e.target.value })} />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-zinc-600">Longitude</label>
                            <Input value={editForm.gpsLng} onChange={(e) => setEditForm({ ...editForm, gpsLng: e.target.value })} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="mb-1 block text-xs text-zinc-600">Radius (meters)</label>
                            <Input value={editForm.gpsRadiusM} onChange={(e) => setEditForm({ ...editForm, gpsRadiusM: e.target.value })} />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-zinc-600">Timezone</label>
                            <TimezoneSelect value={editForm.timezone} onChange={(v) => setEditForm({ ...editForm, timezone: v })} />
                          </div>
                        </div>

                        <div className="border-t border-zinc-100 pt-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Schedule</p>
                          <div className="space-y-3">
                            <div>
                              <label className="mb-1 block text-xs text-zinc-600">Weekly Off Days</label>
                              <OffDayPicker
                                value={editForm.weeklyOffDays}
                                onChange={(v) => setEditForm({ ...editForm, weeklyOffDays: v })}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="mb-1 block text-xs text-zinc-600">Work Start Time</label>
                                <Input
                                  type="time"
                                  value={editForm.workStartTime}
                                  onChange={(e) => setEditForm({ ...editForm, workStartTime: e.target.value })}
                                  placeholder="08:00"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs text-zinc-600">Work End Time</label>
                                <Input
                                  type="time"
                                  value={editForm.workEndTime}
                                  onChange={(e) => setEditForm({ ...editForm, workEndTime: e.target.value })}
                                  placeholder="17:00"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {editError && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{editError}</div>}
                        <div className="flex gap-2">
                          <Button onClick={() => saveEdit(o.id)} disabled={editLoading} className="h-9 px-4 text-sm">
                            {editLoading ? "Saving…" : "Save"}
                          </Button>
                          <Button variant="secondary" onClick={() => { setEditTarget(null); setEditError(null); }} className="h-9 px-4 text-sm">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium text-zinc-900">{o.name}</div>
                            <div className="mt-1 text-xs text-zinc-500">
                              Lat {o.gpsLat} / Lng {o.gpsLng} · Radius {o.gpsRadiusM}m · TZ {o.timezone}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-400">
                              <span>
                                Off: {(o.weeklyOffDays ?? []).length > 0
                                  ? (o.weeklyOffDays ?? []).map((d) => DAY_LABELS[d]).join(", ")
                                  : "None"}
                              </span>
                              {o.workStartTime && <span>Starts {o.workStartTime}</span>}
                              {o.workEndTime && <span>Ends {o.workEndTime}</span>}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              onClick={() => startEdit(o)}
                              className="rounded-lg border border-zinc-200 bg-white px-3 py-1 text-xs hover:bg-zinc-50"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deactivate(o.id)}
                              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-700 hover:bg-red-100"
                            >
                              Deactivate
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>

          {inactiveOffices.length > 0 && (
            <Card title={`Inactive Offices (${inactiveOffices.length})`}>
              <div className="space-y-3">
                {inactiveOffices.map((o) => (
                  <div key={o.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 opacity-70">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-zinc-600">{o.name}</div>
                        <div className="mt-1 text-xs text-zinc-400">
                          Lat {o.gpsLat} / Lng {o.gpsLng} · Radius {o.gpsRadiusM}m · TZ {o.timezone}
                        </div>
                      </div>
                      <button
                        onClick={() => reactivate(o.id)}
                        className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                      >
                        Reactivate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div>
          <Card title="Create Office">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Latitude</label>
                  <Input value={gpsLat} onChange={(e) => setGpsLat(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Longitude</label>
                  <Input value={gpsLng} onChange={(e) => setGpsLng(e.target.value)} />
                </div>
              </div>
              <Button type="button" variant="secondary" onClick={fillFromBrowser}>
                Use my current GPS
              </Button>
              <div>
                <label className="mb-1 block text-sm font-medium">Radius (meters)</label>
                <Input value={gpsRadiusM} onChange={(e) => setGpsRadiusM(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Timezone</label>
                <TimezoneSelect value={timezone} onChange={setTimezone} />
              </div>

              <div className="border-t border-zinc-100 pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Schedule</p>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Weekly Off Days</label>
                    <OffDayPicker value={weeklyOffDays} onChange={setWeeklyOffDays} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Work Start Time</label>
                      <Input
                        type="time"
                        value={workStartTime}
                        onChange={(e) => setWorkStartTime(e.target.value)}
                        placeholder="08:00"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Work End Time</label>
                      <Input
                        type="time"
                        value={workEndTime}
                        onChange={(e) => setWorkEndTime(e.target.value)}
                        placeholder="17:00"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {error ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
              <Button disabled={loading} onClick={createOffice} className="w-full">
                {loading ? "Creating..." : "Create office"}
              </Button>
              <div className="text-xs text-zinc-500">
                Next: generate daily QR in <a className="underline" href="/admin/qr">/admin/qr</a>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
