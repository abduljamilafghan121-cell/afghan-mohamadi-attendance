-- CreateEnum
CREATE TYPE "VisitPlanStatus" AS ENUM ('pending', 'done', 'missed', 'cancelled');

-- CreateEnum
CREATE TYPE "VisitPlanSource" AS ENUM ('template', 'manual');

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "regionId" TEXT;

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyPlanTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "regionId" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyPlanTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyPlanCustomer" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyPlanCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "plannedDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "status" "VisitPlanStatus" NOT NULL DEFAULT 'pending',
    "source" "VisitPlanSource" NOT NULL DEFAULT 'template',
    "templateId" TEXT,
    "visitId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Region_name_key" ON "Region"("name");

-- CreateIndex
CREATE INDEX "Region_name_idx" ON "Region"("name");

-- CreateIndex
CREATE INDEX "WeeklyPlanTemplate_weekday_idx" ON "WeeklyPlanTemplate"("weekday");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyPlanTemplate_userId_weekday_key" ON "WeeklyPlanTemplate"("userId", "weekday");

-- CreateIndex
CREATE INDEX "WeeklyPlanCustomer_shopId_idx" ON "WeeklyPlanCustomer"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyPlanCustomer_templateId_shopId_key" ON "WeeklyPlanCustomer"("templateId", "shopId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitPlan_visitId_key" ON "VisitPlan"("visitId");

-- CreateIndex
CREATE INDEX "VisitPlan_userId_plannedDate_idx" ON "VisitPlan"("userId", "plannedDate");

-- CreateIndex
CREATE INDEX "VisitPlan_status_idx" ON "VisitPlan"("status");

-- CreateIndex
CREATE INDEX "VisitPlan_shopId_idx" ON "VisitPlan"("shopId");

-- CreateIndex
CREATE INDEX "Shop_regionId_idx" ON "Shop"("regionId");

-- AddForeignKey
ALTER TABLE "WeeklyPlanTemplate" ADD CONSTRAINT "WeeklyPlanTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyPlanTemplate" ADD CONSTRAINT "WeeklyPlanTemplate_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyPlanTemplate" ADD CONSTRAINT "WeeklyPlanTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyPlanCustomer" ADD CONSTRAINT "WeeklyPlanCustomer_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WeeklyPlanTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyPlanCustomer" ADD CONSTRAINT "WeeklyPlanCustomer_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitPlan" ADD CONSTRAINT "VisitPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitPlan" ADD CONSTRAINT "VisitPlan_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitPlan" ADD CONSTRAINT "VisitPlan_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WeeklyPlanTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitPlan" ADD CONSTRAINT "VisitPlan_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitPlan" ADD CONSTRAINT "VisitPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;
