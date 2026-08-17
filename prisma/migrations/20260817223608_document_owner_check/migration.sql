ALTER TABLE "Document" ADD CONSTRAINT "Document_exactly_one_owner"
  CHECK (("vehicleId" IS NOT NULL AND "driverId" IS NULL)
      OR ("vehicleId" IS NULL AND "driverId" IS NOT NULL));
