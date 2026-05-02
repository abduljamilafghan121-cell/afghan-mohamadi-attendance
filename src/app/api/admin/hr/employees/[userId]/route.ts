import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { assertRole, getBearerToken, verifyAccessToken } from "../../../../../../lib/auth";

async function getAdmin(req: Request) {
  const token = getBearerToken(req.headers.get("authorization"));
  if (!token) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const user = await verifyAccessToken(token);
  assertRole(user, ["admin"]);
  return user;
}

export async function GET(req: Request, { params }: { params: { userId: string } }) {
  try { await getAdmin(req); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }

  const { userId } = params;

  const [user, contracts, salaryRecords, performanceReviews, trainingRecords, disciplinaryRecords, emergencyContacts] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, name: true, email: true, phone: true, role: true,
          department: true, jobTitle: true, employeeId: true, address: true,
          photoUrl: true, isActive: true, managerId: true, createdAt: true,
          manager: { select: { id: true, name: true } },
        },
      }),
      prisma.employeeContract.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.salaryRecord.findMany({
        where: { userId },
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      }),
      prisma.performanceReview.findMany({
        where: { userId },
        include: { reviewer: { select: { id: true, name: true } } },
        orderBy: { reviewDate: "desc" },
      }),
      prisma.trainingRecord.findMany({
        where: { userId },
        orderBy: { startDate: "desc" },
      }),
      prisma.disciplinaryRecord.findMany({
        where: { userId },
        include: { issuedBy: { select: { id: true, name: true } } },
        orderBy: { date: "desc" },
      }),
      prisma.emergencyContact.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  if (!user) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  return NextResponse.json({
    user,
    contracts,
    salaryRecords,
    performanceReviews,
    trainingRecords,
    disciplinaryRecords,
    emergencyContacts,
  });
}
