import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../lib/auth";

async function getAdmin(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const user = await verifyAccessToken(token);
  assertRole(user, ["admin"]);
  return user;
}

export async function GET(req: Request) {
  try {
    await getAdmin(req);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 403 });
  }

  const url = new URL(req.url);
  const year = url.searchParams.get("year");

  const where: any = {};
  if (year) {
    const y = parseInt(year, 10);
    where.date = {
      gte: new Date(Date.UTC(y, 0, 1)),
      lt: new Date(Date.UTC(y + 1, 0, 1)),
    };
  }

  const holidays = await prisma.holiday.findMany({
    where,
    orderBy: { date: "asc" },
    select: { id: true, date: true, name: true, createdAt: true },
  });

  return NextResponse.json({ holidays });
}

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const CreateSchema = z.object({
  startDate: z.string().regex(dateRegex, "Must be YYYY-MM-DD"),
  endDate: z.string().regex(dateRegex, "Must be YYYY-MM-DD").optional(),
  name: z.string().min(1),
});

function parseDateUtc(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86_400_000);
}

export async function POST(req: Request) {
  let admin;
  try {
    admin = await getAdmin(req);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 403 });
  }

  const body = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "startDate (YYYY-MM-DD) and name required" }, { status: 400 });
  }

  const start = parseDateUtc(body.data.startDate);
  const end = body.data.endDate ? parseDateUtc(body.data.endDate) : start;

  if (end < start) {
    return NextResponse.json({ error: "endDate must be on or after startDate" }, { status: 400 });
  }

  const MAX_DAYS = 60;
  const days: Date[] = [];
  for (let cur = start; cur <= end; cur = addDays(cur, 1)) {
    days.push(new Date(cur));
    if (days.length > MAX_DAYS) {
      return NextResponse.json({ error: `Holiday range too large (max ${MAX_DAYS} days)` }, { status: 400 });
    }
  }

  const results: any[] = [];
  const skipped: string[] = [];

  for (const dateUtc of days) {
    try {
      const holiday = await prisma.holiday.create({
        data: { date: dateUtc, name: body.data.name, createdById: admin.id },
      });
      results.push(holiday);
    } catch (e: any) {
      if (e.code === "P2002") {
        skipped.push(dateUtc.toISOString().slice(0, 10));
      } else {
        throw e;
      }
    }
  }

  return NextResponse.json({ created: results.length, skipped, holidays: results });
}
