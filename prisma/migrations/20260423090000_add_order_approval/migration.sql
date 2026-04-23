-- CreateEnum
CREATE TYPE "OrderApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'order_submitted';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'order_decided';

-- AlterTable
ALTER TABLE "Order"
    ADD COLUMN "status" "OrderApprovalStatus" NOT NULL DEFAULT 'pending',
    ADD COLUMN "reviewedById" TEXT,
    ADD COLUMN "reviewedAt" TIMESTAMP(3),
    ADD COLUMN "reviewNotes" TEXT;

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
