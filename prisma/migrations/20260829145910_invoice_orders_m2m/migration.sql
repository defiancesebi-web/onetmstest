-- Invoice ↔ Order becomes many-to-many. Preserve existing single-order links.

-- 1) Join table (implicit M2M: A = Invoice, B = Order)
CREATE TABLE "_InvoiceToOrder" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_InvoiceToOrder_AB_pkey" PRIMARY KEY ("A","B")
);
CREATE INDEX "_InvoiceToOrder_B_index" ON "_InvoiceToOrder"("B");

-- 2) Copy existing Invoice.orderId links into the join table
INSERT INTO "_InvoiceToOrder" ("A", "B")
SELECT "id", "orderId" FROM "Invoice" WHERE "orderId" IS NOT NULL;

-- 3) Drop the old single FK column
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_orderId_fkey";
ALTER TABLE "Invoice" DROP COLUMN "orderId";

-- 4) Join-table foreign keys
ALTER TABLE "_InvoiceToOrder" ADD CONSTRAINT "_InvoiceToOrder_A_fkey" FOREIGN KEY ("A") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_InvoiceToOrder" ADD CONSTRAINT "_InvoiceToOrder_B_fkey" FOREIGN KEY ("B") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
