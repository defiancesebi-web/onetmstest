import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";

describe("constrângerea de proprietar unic pe Document", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("respinge un document fără proprietar", async () => {
    const company = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });

    await expect(
      prisma.document.create({
        data: {
          companyId: company.id,
          type: "ITP",
          expiresAt: new Date("2026-12-31"),
        },
      })
    ).rejects.toThrow();
  });

  it("respinge un document cu doi proprietari", async () => {
    const company = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });
    const vehicle = await prisma.vehicle.create({
      data: { companyId: company.id, registrationNumber: "B-1-AAA", type: "TRACTOR_UNIT" },
    });
    const driver = await prisma.driver.create({
      data: { companyId: company.id, firstName: "Ion", lastName: "Popescu" },
    });

    await expect(
      prisma.document.create({
        data: {
          companyId: company.id,
          vehicleId: vehicle.id,
          driverId: driver.id,
          type: "ITP",
          expiresAt: new Date("2026-12-31"),
        },
      })
    ).rejects.toThrow();
  });

  it("acceptă un document cu exact un proprietar", async () => {
    const company = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });
    const vehicle = await prisma.vehicle.create({
      data: { companyId: company.id, registrationNumber: "B-1-AAA", type: "TRACTOR_UNIT" },
    });

    const doc = await prisma.document.create({
      data: {
        companyId: company.id,
        vehicleId: vehicle.id,
        type: "ITP",
        expiresAt: new Date("2026-12-31"),
      },
    });

    expect(doc.vehicleId).toBe(vehicle.id);
    expect(doc.driverId).toBeNull();
  });
});
