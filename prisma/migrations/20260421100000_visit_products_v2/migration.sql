-- Reshape VisitProduct: drop quantity, rename unitPrice -> offeredPrice (nullable), add discussion
ALTER TABLE "VisitProduct" DROP COLUMN "quantity";
ALTER TABLE "VisitProduct" RENAME COLUMN "unitPrice" TO "offeredPrice";
ALTER TABLE "VisitProduct" ALTER COLUMN "offeredPrice" DROP NOT NULL;
ALTER TABLE "VisitProduct" ADD COLUMN "discussion" TEXT;
