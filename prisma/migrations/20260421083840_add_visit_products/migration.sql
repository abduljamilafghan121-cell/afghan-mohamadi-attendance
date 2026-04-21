-- CreateTable
CREATE TABLE "VisitProduct" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "interest" TEXT,

    CONSTRAINT "VisitProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisitProduct_visitId_idx" ON "VisitProduct"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitProduct_visitId_productId_key" ON "VisitProduct"("visitId", "productId");

-- AddForeignKey
ALTER TABLE "VisitProduct" ADD CONSTRAINT "VisitProduct_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitProduct" ADD CONSTRAINT "VisitProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
