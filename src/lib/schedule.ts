export function getDayOfWeekInTimeZone(date: Date, timeZone: string): number {
  const noonUtc = new Date(date.getTime() + 12 * 60 * 60 * 1000);
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" });
    const w = fmt.format(noonUtc).toLowerCase();
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    return days.findIndex((d) => w.startsWith(d));
  } catch {
    return noonUtc.getUTCDay();
  }
}

export function isOffDay(workDate: Date, weeklyOffDays: number[], timeZone: string): boolean {
  const dow = getDayOfWeekInTimeZone(workDate, timeZone);
  return weeklyOffDays.includes(dow);
}

export function parseTimeHHMM(time: string): { hours: number; minutes: number } | null {
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return { hours: parseInt(m[1], 10), minutes: parseInt(m[2], 10) };
}

export function getLocalTimeMinutes(utcDate: Date, timeZone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(utcDate);
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    return hour * 60 + minute;
  } catch {
    return utcDate.getUTCHours() * 60 + utcDate.getUTCMinutes();
  }
}

export function calcLateMinutes(checkInAt: Date, workStartTime: string, timeZone: string): number {
  const parsed = parseTimeHHMM(workStartTime);
  if (!parsed) return 0;
  const startMinutes = parsed.hours * 60 + parsed.minutes;
  const actualMinutes = getLocalTimeMinutes(checkInAt, timeZone);
  return Math.max(0, actualMinutes - startMinutes);
}

export function calcEarlyDepartureMinutes(checkOutAt: Date, workEndTime: string, timeZone: string): number {
  const parsed = parseTimeHHMM(workEndTime);
  if (!parsed) return 0;
  const endMinutes = parsed.hours * 60 + parsed.minutes;
  const actualMinutes = getLocalTimeMinutes(checkOutAt, timeZone);
  return Math.max(0, endMinutes - actualMinutes);
}

export function startOfDayUtcFromDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
