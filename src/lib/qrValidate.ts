import { prisma } from "./prisma";
import { hashQrToken } from "./qr";

export type QrValidationOk = {
  ok: true;
  qr: {
    id: string;
    officeId: string;
    purpose: string;
    validFrom: Date;
    validTo: Date;
    workDate: Date;
  };
};

export type QrValidationError = {
  ok: false;
  status: number;
  code:
    | "BAD_PAYLOAD"
    | "TOKEN_NOT_FOUND"
    | "OFFICE_MISMATCH"
    | "WRONG_PURPOSE"
    | "NOT_YET_VALID"
    | "EXPIRED";
  message: string;
  details?: Record<string, unknown>;
};

export type QrValidationResult = QrValidationOk | QrValidationError;

function fmt(date: Date, timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

/**
 * Validate a scanned QR payload for either check-in or check-out.
 * Returns an object describing exactly which check failed so the
 * employee (and admin) sees a precise reason instead of a generic
 * "QR invalid or expired" message.
 */
export async function validateQrForAttendance(opts: {
  qrPayload: string;
  scanFor: "check_in" | "check_out";
  scannedOfficeId: string;
  officeTimezone: string;
  now?: Date;
}): Promise<QrValidationResult> {
  const now = opts.now ?? new Date();
  const tz = opts.officeTimezone || "UTC";

  // 1. Parse the QR payload
  let parsed: any;
  try {
    parsed = JSON.parse(opts.qrPayload);
  } catch {
    return {
      ok: false,
      status: 400,
      code: "BAD_PAYLOAD",
      message:
        "We could not read this QR. Please scan the official daily attendance QR.",
    };
  }
  if (!parsed?.token || typeof parsed.token !== "string") {
    return {
      ok: false,
      status: 400,
      code: "BAD_PAYLOAD",
      message:
        "This QR does not contain a valid attendance token. Please scan the official daily QR provided by your admin.",
    };
  }

  // 2. Look up the token hash without any other filter so we can
  //    diagnose exactly which condition fails.
  const tokenHash = hashQrToken(parsed.token);
  const qr = await prisma.dailyQrToken.findFirst({
    where: { tokenHash },
    include: { office: { select: { id: true, name: true, timezone: true } } },
  });

  if (!qr) {
    return {
      ok: false,
      status: 400,
      code: "TOKEN_NOT_FOUND",
      message:
        "This QR is not recognised. It may have been replaced by a newer one — please ask your admin for today's QR code.",
    };
  }

  // 3. Office mismatch — QR belongs to a different office than the
  //    one the employee is currently checking into.
  if (qr.officeId !== opts.scannedOfficeId) {
    return {
      ok: false,
      status: 400,
      code: "OFFICE_MISMATCH",
      message: `This QR is for "${qr.office.name}". You are checking in at a different office. Please scan the QR for your office.`,
      details: { qrOfficeId: qr.officeId, scannedOfficeId: opts.scannedOfficeId },
    };
  }

  const qrTz = qr.office.timezone || tz || "UTC";

  // 4. Purpose mismatch — e.g. employee tries to check out with the
  //    check-in QR.
  const purposeOk =
    qr.purpose === "both" ||
    (opts.scanFor === "check_in" && qr.purpose === "check_in") ||
    (opts.scanFor === "check_out" && qr.purpose === "check_out");

  if (!purposeOk) {
    const qrLabel =
      qr.purpose === "check_in"
        ? "Check-In"
        : qr.purpose === "check_out"
          ? "Check-Out"
          : "Both";
    const wantedLabel = opts.scanFor === "check_in" ? "Check-In" : "Check-Out";
    return {
      ok: false,
      status: 400,
      code: "WRONG_PURPOSE",
      message: `Wrong QR scanned. This is the "${qrLabel}" QR but you are trying to ${wantedLabel}. Please scan the "${wantedLabel}" QR instead.`,
      details: { qrPurpose: qr.purpose, scanFor: opts.scanFor },
    };
  }

  // 5. Time window — not yet active
  if (now < qr.validFrom) {
    return {
      ok: false,
      status: 400,
      code: "NOT_YET_VALID",
      message: `This QR is not active yet. It becomes valid at ${fmt(qr.validFrom, qrTz)} (${qrTz}). Please try again at that time.`,
      details: { validFrom: qr.validFrom.toISOString() },
    };
  }

  // 6. Time window — already expired
  if (now > qr.validTo) {
    return {
      ok: false,
      status: 400,
      code: "EXPIRED",
      message: `This QR expired at ${fmt(qr.validTo, qrTz)} (${qrTz}). Please ask your admin to issue a new QR.`,
      details: { validTo: qr.validTo.toISOString() },
    };
  }

  // All checks passed.
  return {
    ok: true,
    qr: {
      id: qr.id,
      officeId: qr.officeId,
      purpose: qr.purpose,
      validFrom: qr.validFrom,
      validTo: qr.validTo,
      workDate: qr.workDate,
    },
  };
}
