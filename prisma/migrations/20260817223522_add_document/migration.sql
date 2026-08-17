-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('ITP', 'RCA', 'CASCO', 'ROVINIETA', 'TAHOGRAF', 'COPIE_CONFORMA', 'ASIGURARE_CMR', 'PERMIS_CONDUCERE', 'ATESTAT_PROFESIONAL', 'CARD_TAHOGRAF', 'AVIZ_MEDICAL', 'AVIZ_PSIHOLOGIC');

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "type" "DocumentType" NOT NULL,
    "number" TEXT,
    "issuedAt" DATE,
    "expiresAt" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_companyId_expiresAt_idx" ON "Document"("companyId", "expiresAt");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
