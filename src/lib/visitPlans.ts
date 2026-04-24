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
/**
 * Returns the set of userIds who are on outstation on the given date.
 */
export async function getOutstationUserIdsForDate(date: Date): Promise<Set<string>> {
  const day = startOfDay(date);
  const rows = await prisma.outstationDay.findMany({
    where: {
      startDate: { lte: endOfDay(day) },
      endDate: { gte: day },
    },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

/**
 * Returns the user's outstation entry covering this date, or null.
 */
export async function getOutstationForUserDate(userId: string, date: Date) {
  const day = startOfDay(date);
  return prisma.outstationDay.findFirst({
    where: {
      userId,
      startDate: { lte: endOfDay(day) },
      endDate: { gte: day },
    },
    orderBy: { startDate: "asc" },
  });
}

export async function ensurePlansForDate(date: Date, userId?: string | null) {
  const day = startOfDay(date);
  const weekday = day.getDay();

  const outstation = await getOutstationUserIdsForDate(day);

  const office = await prisma.office.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { weeklyOffDays: true },
  });
  const isOfficeOffDay = (office?.weeklyOffDays ?? [5]).includes(weekday);

  const dayUtc = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  const holiday = await prisma.holiday.findFirst({ where: { date: dayUtc } });

  // If the date is a public holiday or a weekly office off day, skip
  // template-based generation entirely. Admins can still create manual plans
  // for that date through the API (which checks WorkdayOverride per-user).
  if (holiday || isOfficeOffDay) return;

  const templates = await prisma.weeklyPlanTemplate.findMany({
    where: {
      weekday,
      isActive: true,
      ...(userId ? { userId } : {}),
    },
    include: { customers: true },
  });

  // Skip generation for any user with an approved leave covering this date.
  const userIdsInTemplates = Array.from(new Set(templates.map((t) => t.userId)));
  let onLeaveUserIds = new Set<string>();
  if (userIdsInTemplates.length > 0) {
    const leaves = await prisma.leaveRequest.findMany({
      where: {
        userId: { in: userIdsInTemplates },
        status: "approved",
        startDate: { lte: day },
        endDate: { gte: day },
      },
      select: { userId: true },
    });
    onLeaveUserIds = new Set(leaves.map((l) => l.userId));
  }

  for (const tpl of templates) {
    if (tpl.customers.length === 0) continue;
    // Skip generation for users on outstation that day.
    if (outstation.has(tpl.userId)) continue;
    // Skip generation for users on approved leave that day.
    if (onLeaveUserIds.has(tpl.userId)) continue;

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
 * Mark any pending plans whose planned date is before today as "missed",
 * EXCEPT for plans that fall inside an outstation range — those become
 * "cancelled" with an "Outstation" note instead of "missed".
 */
export async function markPastPlansMissed() {
  const today = startOfDay(new Date());

  const pastPending = await prisma.visitPlan.findMany({
    where: { status: "pending", plannedDate: { lt: today } },
    select: { id: true, userId: true, plannedDate: true, notes: true },
  });
  if (pastPending.length === 0) return;

  const userIds = Array.from(new Set(pastPending.map((p) => p.userId)));
  const outstations = await prisma.outstationDay.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, startDate: true, endDate: true },
  });

  const isOutstation = (uid: string, d: Date) =>
    outstations.some(
      (o) => o.userId === uid && o.startDate <= d && o.endDate >= startOfDay(d),
    );

  const toCancelIds: string[] = [];
  const toMissIds: string[] = [];
  for (const p of pastPending) {
    if (isOutstation(p.userId, p.plannedDate)) toCancelIds.push(p.id);
    else toMissIds.push(p.id);
  }

  if (toCancelIds.length > 0) {
    await prisma.visitPlan.updateMany({
      where: { id: { in: toCancelIds } },
      data: { status: "cancelled" },
    });
  }
  if (toMissIds.length > 0) {
    await prisma.visitPlan.updateMany({
      where: { id: { in: toMissIds } },
      data: { status: "missed" },
    });
  }
}

/**
 * Called after an outstation entry is created/updated.
 * For each day in the range, cancel any pending template plans for that user
 * (manual one-off plans are preserved — admin may have planned them on purpose).
 */
export async function cancelPendingPlansForOutstation(
  userId: string,
  startDate: Date,
  endDate: Date,
) {
  await prisma.visitPlan.updateMany({
    where: {
      userId,
      status: "pending",
      source: "template",
      plannedDate: { gte: startOfDay(startDate), lte: endOfDay(endDate) },
    },
    data: { status: "cancelled" },
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
