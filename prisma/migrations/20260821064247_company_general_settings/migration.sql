-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "shareCapital" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "sellerCapital" TEXT,
ADD COLUMN     "sellerEmail" TEXT,
ADD COLUMN     "sellerPhone" TEXT;
