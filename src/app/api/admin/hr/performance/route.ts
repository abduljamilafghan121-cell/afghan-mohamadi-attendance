import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../../lib/auth";
import { logActivity } from "../../../../../lib/activityLog";

async function getAdmin(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const user = await verifyAccessToken(token);
  assertRole(user, ["admin"]);
  return user;
}

const ReviewSchema = z.object({
  userId: z.string().min(1),
  reviewerId: z.string().min(1),
  reviewPeriod: z.string().min(1),
  rating: z.enum(["outstanding", "exceeds_expectations", "meets_expectations", "needs_improvement", "unsatisfactory"]),
  goals: z.string().optional().nullable(),
  achievements: z.string().optional().nullable(),
  improvements: z.string().optional().nullable(),
  comments: z.string().optional().nullable(),
  reviewDate: z.string(),
});

export async function GET(req: Request) {
  try { await getAdmin(req); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
  const userId = new URL(req.url).searchParams.get("userId");
  const reviews = await prisma.performanceReview.findMany({
    where: userId ? { userId } : {},
    include: {
      user: { select: { id: true, name: true, department: true } },
      reviewer: { select: { id: true, name: true } },
    },
    orderBy: { reviewDate: "desc" },
  });
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, department: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ reviews, users });
}

export async function POST(req: Request) {
  let admin;
  try { admin = await getAdmin(req); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
  const body = ReviewSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const d = body.data;
  const review = await prisma.performanceReview.create({
    data: { ...d, reviewDate: new Date(d.reviewDate) },
  });
  logActivity(admin.id, "create_review", "hr", `Performance review for ${d.userId}`).catch(() => null);
  return NextResponse.json({ review }, { status: 201 });
}

export async function PATCH(req: Request) {
  let admin;
  try { admin = await getAdmin(req); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
  const body = ReviewSchema.partial().extend({ id: z.string() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { id, ...rest } = body.data;
  const review = await prisma.performanceReview.update({
    where: { id },
    data: { ...rest, reviewDate: rest.reviewDate ? new Date(rest.reviewDate) : undefined },
  });
  logActivity(admin.id, "update_review", "hr", `Updated review ${id}`).catch(() => null);
  return NextResponse.json({ review });
}

export async function DELETE(req: Request) {
  let admin;
  try { admin = await getAdmin(req); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.performanceReview.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
