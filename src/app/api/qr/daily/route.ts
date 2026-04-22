import { NextResponse } from "next/server";
import { z } from "zod";
import QRCode from "qrcode";
import { prisma } from "../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../lib/auth";
import { generateQrToken, hashQrToken, startOfDayInTimeZone, startOfDayUtc } from "../../../../lib/qr";
import { notifyAll } from "../../../../lib/notify";

const CreateDailyQrSchema = z.object({
  officeId: z.string().min(1),
  workDate: z.string().optional(),
  purpose: z.enum(["check_in", "check_out", "both"]).default("both"),
  validFromIso: z.string().min(1),
  validToIso: z.string().min(1),
});

export async function POST(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let user;
  try {
    user = await verifyAccessToken(token);
    assertRole(user, ["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = CreateDailyQrSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const office = await prisma.office.findUnique({ where: { id: body.data.officeId } });
  if (!office || !office.isActive) {
    return NextResponse.json({ error: "Office not found" }, { status: 404 });
  }

  const now = new Date();
  const workDate = body.data.workDate ? new Date(body.data.workDate) : startOfDayInTimeZone(now, office.timezone ?? "UTC");
  const validFrom = new Date(body.data.validFromIso);
  const validTo = new Date(body.data.validToIso);
  if (!(validFrom instanceof Date) || !(validTo instanceof Date) || isNaN(validFrom.getTime()) || isNaN(validTo.getTime())) {
    return NextResponse.json({ error: "Invalid validFrom/validTo" }, { status: 400 });
  }
  if (validTo <= validFrom) {
    return NextResponse.json({ error: "validTo must be after validFrom" }, { status: 400 });
  }

  const rawToken = generateQrToken();
  const tokenHash = hashQrToken(rawToken);

  const dailyQr = await prisma.dailyQrToken.create({
    data: {
      officeId: office.id,
      workDate,
      purpose: body.data.purpose,
      tokenHash,
      validFrom,
      validTo,
      createdByAdminId: user.id,
    },
  });

  const qrPayload = JSON.stringify({
    token: rawToken,
    officeId: office.id,
    workDate: workDate.toISOString(),
    purpose: dailyQr.purpose,
  });

  const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 320 });

  const purposeLabel = dailyQr.purpose === "both" ? "Check-In & Check-Out" : dailyQr.purpose === "check_in" ? "Check-In" : "Check-Out";
  await notifyAll(
    {
      type: "qr_generated",
      title: `New ${purposeLabel} QR available`,
      body: `${office.name} · valid ${validFrom.toLocaleString()} → ${validTo.toLocaleString()}`,
      link: "/employee",
    },
    user.id,
  );

  return NextResponse.json({
    dailyQr: {
      id: dailyQr.id,
      officeId: dailyQr.officeId,
      workDate: dailyQr.workDate,
      purpose: dailyQr.purpose,
      validFrom: dailyQr.validFrom,
      validTo: dailyQr.validTo,
    },
    qrDataUrl,
    qrPayload,
  });
}
