import { prisma } from "./prisma";

type NotificationType =
  | "leave_submitted"
  | "leave_decided"
  | "correction_submitted"
  | "correction_decided"
  | "qr_generated"
  | "late_check_in"
  | "broadcast"
  | "system"
  | "order_submitted"
  | "order_decided";

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
}

/**
 * Create a single notification. Never throws — notification failures must
 * not break the underlying business action that triggered them.
 */
export async function notifyUser(input: NotifyInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
      },
    });
  } catch (err) {
    console.error("[notify] failed to create notification", err);
  }
}

/**
 * Fan-out a notification to many users. Uses createMany for efficiency.
 */
export async function notifyUsers(
  userIds: string[],
  data: Omit<NotifyInput, "userId">,
): Promise<number> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return 0;
  try {
    const res = await prisma.notification.createMany({
      data: ids.map((userId) => ({
        userId,
        type: data.type,
        title: data.title,
        body: data.body ?? null,
        link: data.link ?? null,
      })),
    });
    return res.count;
  } catch (err) {
    console.error("[notify] failed bulk create", err);
    return 0;
  }
}

/**
 * Notify every active admin.
 */
export async function notifyAdmins(
  data: Omit<NotifyInput, "userId">,
): Promise<number> {
  const admins = await prisma.user.findMany({
    where: { role: "admin", isActive: true },
    select: { id: true },
  });
  return notifyUsers(
    admins.map((a) => a.id),
    data,
  );
}

/**
 * Notify every user with a given role (admin / manager / employee).
 */
export async function notifyRole(
  role: "admin" | "manager" | "employee",
  data: Omit<NotifyInput, "userId">,
): Promise<number> {
  const users = await prisma.user.findMany({
    where: { role, isActive: true },
    select: { id: true },
  });
  return notifyUsers(
    users.map((u) => u.id),
    data,
  );
}

/**
 * Notify every active user in the system (for broadcasts).
 * Optionally exclude one user (e.g. the admin who created the broadcast).
 */
export async function notifyAll(
  data: Omit<NotifyInput, "userId">,
  excludeUserId?: string,
): Promise<number> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true },
  });
  return notifyUsers(
    users.map((u) => u.id),
    data,
  );
}
