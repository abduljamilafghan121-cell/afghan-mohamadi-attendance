import crypto from "crypto";

export function generateQrToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashQrToken(token: string) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function startOfDayUtc(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function startOfDayFromDateString(dateStr: string) {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(dateStr.trim());
  if (!m) return startOfDayUtc(new Date(dateStr));
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo - 1, d));
}

export function startOfDayInTimeZone(now: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);

    const get = (type: string) => parts.find((p) => p.type === type)?.value;
    const y = Number(get("year"));
    const mo = Number(get("month"));
    const d = Number(get("day"));
    if (!y || !mo || !d) return startOfDayUtc(now);
    return new Date(Date.UTC(y, mo - 1, d));
  } catch {
    return startOfDayUtc(now);
  }
}
