-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'RON',
ADD COLUMN     "exchangeRate" DECIMAL(10,4);

-- AlterTable
ALTER TABLE "FixedCost" ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'RON',
ADD COLUMN     "exchangeRate" DECIMAL(10,4);
