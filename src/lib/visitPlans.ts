import { prisma } from "./prisma";

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function parseDateParam(s: string | null | undefined): Date {
  if (!s) return startOfDay(new Date());
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return startOfDay(new Date());
  return startOfDay(d);
}

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Ensure VisitPlan rows exist for the given user + date based on their
 * active WeeklyPlanTemplate matching the date's weekday.
 * - Creates pending plans for any template customers missing on that date.
 * - Does NOT delete plans already present (cascade-on-add only here).
 *
 * For "all users" generation, pass userId = null.
 */
export async function ensurePlansForDate(date: Date, userId?: string | null) {
  const day = startOfDay(date);
  const weekday = day.getDay();

  const templates = await prisma.weeklyPlanTemplate.findMany({
    where: {
      weekday,
      isActive: true,
      ...(userId ? { userId } : {}),
    },
    include: { customers: true },
  });

  for (const tpl of templates) {
    if (tpl.customers.length === 0) continue;

    const existing = await prisma.visitPlan.findMany({
      where: {
        userId: tpl.userId,
        plannedDate: { gte: day, lte: endOfDay(day) },
      },
      select: { shopId: true, source: true },
    });
    const existingShops = new Set(existing.map((e) => e.shopId));

    const toCreate = tpl.customers
      .filter((c) => !existingShops.has(c.shopId))
      .map((c) => ({
        userId: tpl.userId,
        shopId: c.shopId,
        plannedDate: day,
        notes: tpl.notes ?? null,
        status: "pending" as const,
        source: "template" as const,
        templateId: tpl.id,
        createdById: tpl.createdById,
      }));

    if (toCreate.length > 0) {
      await prisma.visitPlan.createMany({ data: toCreate, skipDuplicates: true });
    }
  }
}

/**
 * After a template is edited, sync TODAY's already-generated plans to match:
 *   - Add plans for newly-added customers.
 *   - Cancel pending template plans for removed customers (preserve done).
 * Does not affect manual one-off plans or past dates.
 */
export async function syncTodayFromTemplate(templateId: string) {
  const tpl = await prisma.weeklyPlanTemplate.findUnique({
    where: { id: templateId },
    include: { customers: true },
  });
  if (!tpl) return;

  const today = startOfDay(new Date());
  if (today.getDay() !== tpl.weekday) return;
  if (!tpl.isActive) return;

  const todayPlans = await prisma.visitPlan.findMany({
    where: {
      userId: tpl.userId,
      plannedDate: { gte: today, lte: endOfDay(today) },
      source: "template",
      templateId: tpl.id,
    },
  });

  const tplShopIds = new Set(tpl.customers.map((c) => c.shopId));
  const existingShopIds = new Set(todayPlans.map((p) => p.shopId));

  // Add missing
  const toCreate = tpl.customers
    .filter((c) => !existingShopIds.has(c.shopId))
    .map((c) => ({
      userId: tpl.userId,
      shopId: c.shopId,
      plannedDate: today,
      notes: tpl.notes ?? null,
      status: "pending" as const,
      source: "template" as const,
      templateId: tpl.id,
      createdById: tpl.createdById,
    }));
  if (toCreate.length > 0) {
    await prisma.visitPlan.createMany({ data: toCreate, skipDuplicates: true });
  }

  // Cancel pending plans for removed customers (preserve done/missed/cancelled)
  const toCancel = todayPlans
    .filter((p) => !tplShopIds.has(p.shopId) && p.status === "pending")
    .map((p) => p.id);
  if (toCancel.length > 0) {
    await prisma.visitPlan.deleteMany({ where: { id: { in: toCancel } } });
  }
}

/**
 * Mark any pending plans whose planned date is before today as "missed".
 */
export async function markPastPlansMissed() {
  const today = startOfDay(new Date());
  await prisma.visitPlan.updateMany({
    where: {
      status: "pending",
      plannedDate: { lt: today },
    },
    data: { status: "missed" },
  });
}

/**
 * When a salesman logs an actual visit, link it to a matching pending plan
 * (same user, same shop, today) and mark that plan as done.
 */
export async function linkVisitToPlan(visitId: string, userId: string, shopId: string) {
  const today = startOfDay(new Date());
  const plan = await prisma.visitPlan.findFirst({
    where: {
      userId,
      shopId,
      status: "pending",
      plannedDate: { gte: today, lte: endOfDay(today) },
    },
    orderBy: { createdAt: "asc" },
  });
  if (!plan) return null;
  await prisma.visitPlan.update({
    where: { id: plan.id },
    data: { status: "done", visitId },
  });
  return plan.id;
}
