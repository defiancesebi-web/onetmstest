-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EfacturaStatus" AS ENUM ('NOT_SENT', 'PENDING', 'SENT', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "address" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'România',
ADD COLUMN     "county" TEXT,
ADD COLUMN     "iban" TEXT,
ADD COLUMN     "invoiceSeries" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "regCom" TEXT,
ADD COLUMN     "vatPayer" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "series" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'RON',
    "exchangeRate" DECIMAL(10,4),
    "clientId" TEXT,
    "buyerName" TEXT NOT NULL,
    "buyerCui" TEXT NOT NULL,
    "buyerRegCom" TEXT,
    "buyerAddress" TEXT NOT NULL,
    "buyerCity" TEXT NOT NULL,
    "buyerCounty" TEXT,
    "buyerCountry" TEXT NOT NULL DEFAULT 'România',
    "sellerName" TEXT NOT NULL,
    "sellerCui" TEXT NOT NULL,
    "sellerRegCom" TEXT,
    "sellerAddress" TEXT NOT NULL,
    "sellerCity" TEXT NOT NULL,
    "sellerCounty" TEXT,
    "sellerCountry" TEXT NOT NULL DEFAULT 'România',
    "sellerIban" TEXT,
    "sellerBank" TEXT,
    "sellerVatPayer" BOOLEAN NOT NULL DEFAULT true,
    "netTotal" DECIMAL(12,2) NOT NULL,
    "vatTotal" DECIMAL(12,2) NOT NULL,
    "grossTotal" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "orderId" TEXT,
    "efacturaStatus" "EfacturaStatus" NOT NULL DEFAULT 'NOT_SENT',
    "issuedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'buc',
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "vatAmount" DECIMAL(12,2) NOT NULL,
    "grossAmount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Invoice_companyId_status_idx" ON "Invoice"("companyId", "status");

-- CreateIndex
CREATE INDEX "Invoice_companyId_clientId_idx" ON "Invoice"("companyId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_companyId_invoiceNumber_key" ON "Invoice"("companyId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_companyId_series_number_key" ON "Invoice"("companyId", "series", "number");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLine_invoiceId_sequence_key" ON "InvoiceLine"("invoiceId", "sequence");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
