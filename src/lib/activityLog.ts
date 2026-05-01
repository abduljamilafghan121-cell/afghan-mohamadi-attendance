import { prisma } from "./prisma";

export type ActivityModule =
  | "auth"
  | "attendance"
  | "leave"
  | "correction"
  | "sales"
  | "admin"
  | "hr";

export async function logActivity(
  userId: string,
  action: string,
  module: ActivityModule,
  details?: string,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: { userId, action, module, details: details ?? null },
    });
  } catch {
    // logging failures must never break the main flow
  }
}
