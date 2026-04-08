-- Add work schedule fields to Office
ALTER TABLE "Office" ADD COLUMN "weeklyOffDays" INTEGER[] NOT NULL DEFAULT ARRAY[5];
ALTER TABLE "Office" ADD COLUMN "workStartTime" TEXT;
ALTER TABLE "Office" ADD COLUMN "workEndTime" TEXT;

-- Add late/overtime flags to AttendanceSession
ALTER TABLE "AttendanceSession" ADD COLUMN "isLateArrival" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AttendanceSession" ADD COLUMN "isEarlyDeparture" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AttendanceSession" ADD COLUMN "isOvertime" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AttendanceSession" ADD COLUMN "minutesLate" INTEGER;
ALTER TABLE "AttendanceSession" ADD COLUMN "minutesEarlyDeparture" INTEGER;

-- CreateTable Holiday
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");
CREATE INDEX "Holiday_date_idx" ON "Holiday"("date");

-- CreateTable WorkdayOverride
CREATE TABLE "WorkdayOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isOvertime" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkdayOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkdayOverride_userId_date_key" ON "WorkdayOverride"("userId", "date");
CREATE INDEX "WorkdayOverride_userId_idx" ON "WorkdayOverride"("userId");
CREATE INDEX "WorkdayOverride_date_idx" ON "WorkdayOverride"("date");

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkdayOverride" ADD CONSTRAINT "WorkdayOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkdayOverride" ADD CONSTRAINT "WorkdayOverride_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
