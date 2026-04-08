import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const org = await prisma.organization.findUnique({
    where: { key: "primary" },
    select: { title: true, logoUrl: true },
  });

  return NextResponse.json({ org }, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
