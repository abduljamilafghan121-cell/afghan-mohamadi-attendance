-- CreateTable
CREATE TABLE "OutstationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'pending',
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decisionNote" TEXT,
    "outstationDayId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutstationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutstationRequest_outstationDayId_key" ON "OutstationRequest"("outstationDayId");

-- CreateIndex
CREATE INDEX "OutstationRequest_userId_idx" ON "OutstationRequest"("userId");

-- CreateIndex
CREATE INDEX "OutstationRequest_status_idx" ON "OutstationRequest"("status");

-- CreateIndex
CREATE INDEX "OutstationRequest_startDate_idx" ON "OutstationRequest"("startDate");

-- AddForeignKey
ALTER TABLE "OutstationRequest" ADD CONSTRAINT "OutstationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutstationRequest" ADD CONSTRAINT "OutstationRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
