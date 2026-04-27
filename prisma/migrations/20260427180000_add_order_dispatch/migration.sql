-- Add `dispatched` to OrderApprovalStatus enum
ALTER TYPE "OrderApprovalStatus" ADD VALUE IF NOT EXISTS 'dispatched';

-- New enum tracking what happened with the WhatsApp dispatch message
DO $$ BEGIN
  CREATE TYPE "OrderMessageStatus" AS ENUM ('not_attempted', 'link_opened', 'invalid_phone');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add dispatch tracking columns to Order
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "dispatchedAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dispatchedById" TEXT,
  ADD COLUMN IF NOT EXISTS "messageStatus"  "OrderMessageStatus" NOT NULL DEFAULT 'not_attempted',
  ADD COLUMN IF NOT EXISTS "messageReason"  TEXT;

-- FK for dispatchedBy → User (nullable, on user delete set null)
DO $$ BEGIN
  ALTER TABLE "Order"
    ADD CONSTRAINT "Order_dispatchedById_fkey"
    FOREIGN KEY ("dispatchedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
