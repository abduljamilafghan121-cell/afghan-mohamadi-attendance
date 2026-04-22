-- CreateTable
CREATE TABLE "OutstationDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutstationDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutstationDay_userId_idx" ON "OutstationDay"("userId");

-- CreateIndex
CREATE INDEX "OutstationDay_startDate_idx" ON "OutstationDay"("startDate");

-- CreateIndex
CREATE INDEX "OutstationDay_endDate_idx" ON "OutstationDay"("endDate");

-- AddForeignKey
ALTER TABLE "OutstationDay" ADD CONSTRAINT "OutstationDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutstationDay" ADD CONSTRAINT "OutstationDay_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
