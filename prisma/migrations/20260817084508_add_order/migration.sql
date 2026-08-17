-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'CONFIRMED', 'IN_PROGRESS', 'DELIVERED', 'DOCUMENTS_RECEIVED', 'INVOICED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('RON', 'EUR');

-- CreateEnum
CREATE TYPE "StopType" AS ENUM ('LOADING', 'UNLOADING');

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientReference" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
    "cargoDescription" TEXT NOT NULL,
    "cargoWeightKg" DECIMAL(10,3),
    "cargoPackaging" TEXT,
    "salePrice" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "exchangeRate" DECIMAL(10,4) NOT NULL,
    "exchangeRateDate" DATE NOT NULL,
    "salePriceRon" DECIMAL(12,2) NOT NULL,
    "estimatedCostRon" DECIMAL(12,2),
    "paymentTermDays" INTEGER NOT NULL,
    "documentsReceivedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStop" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" "StopType" NOT NULL,
    "locationName" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'România',
    "scheduledDate" DATE NOT NULL,
    "timeFrom" TEXT,
    "timeTo" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "notes" TEXT,

    CONSTRAINT "OrderStop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_companyId_status_idx" ON "Order"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Order_companyId_year_sequence_key" ON "Order"("companyId", "year", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Order_companyId_orderNumber_key" ON "Order"("companyId", "orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "OrderStop_orderId_sequence_key" ON "OrderStop"("orderId", "sequence");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStop" ADD CONSTRAINT "OrderStop_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
