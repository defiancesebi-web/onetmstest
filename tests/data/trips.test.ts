import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import { createTrip, InvalidTripError } from "@/lib/data/trips";
import { currentOrderYear } from "@/lib/data/orders";
import { TenantAccessError } from "@/lib/tenancy";

function d(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

async function makeCompany(name: string, cui: string) {
  return prisma.company.create({ data: { name, cui } });
}

function tripInput(companyId: string, overrides = {}) {
  return {
    companyId,
    startsAt: d("2026-09-01"),
    endsAt: d("2026-09-05"),
    ...overrides,
  };
}

describe("createTrip", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creează o cursă planificată, fără resurse alocate", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

    const trip = await createTrip(session, tripInput(company.id));

    expect(trip.status).toBe("PLANNED");
    expect(trip.tripNumber).toBe(`C-${currentOrderYear()}-0001`);
    expect(trip.tractorUnitId).toBeNull();
    expect(trip.primaryDriverId).toBeNull();
    expect(trip.datesEditedManually).toBe(false);
  });

  it("numerotează secvențial în cadrul firmei", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

    const first = await createTrip(session, tripInput(company.id));
    const second = await createTrip(session, tripInput(company.id));

    expect(second.sequence).toBe(first.sequence + 1);
  });

  it("numerotează independent pentru fiecare firmă", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");

    await createTrip({ role: "COMPANY_ADMIN", companyId: a.id }, tripInput(a.id));
    const tripB = await createTrip({ role: "COMPANY_ADMIN", companyId: b.id }, tripInput(b.id));

    expect(tripB.sequence).toBe(1);
  });

  it("nu dă același număr la curse create simultan", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

    const results = await Promise.all([
      createTrip(session, tripInput(company.id)),
      createTrip(session, tripInput(company.id)),
      createTrip(session, tripInput(company.id)),
    ]);

    expect(new Set(results.map((t) => t.tripNumber)).size).toBe(3);
    expect(results.map((t) => t.sequence).sort((x, y) => x - y)).toEqual([1, 2, 3]);
  });

  it("acceptă resurse la creare", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    const tractor = await prisma.vehicle.create({
      data: { companyId: company.id, registrationNumber: "B-1-AAA", type: "TRACTOR_UNIT" },
    });
    const driver = await prisma.driver.create({
      data: { companyId: company.id, firstName: "Ion", lastName: "Popescu" },
    });

    const trip = await createTrip(
      session,
      tripInput(company.id, { tractorUnitId: tractor.id, primaryDriverId: driver.id })
    );

    expect(trip.tractorUnitId).toBe(tractor.id);
    expect(trip.primaryDriverId).toBe(driver.id);
  });

  it("respinge un vehicul care aparține altei firme", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");
    const foreign = await prisma.vehicle.create({
      data: { companyId: b.id, registrationNumber: "CJ-9-ZZZ", type: "TRACTOR_UNIT" },
    });

    await expect(
      createTrip(
        { role: "COMPANY_ADMIN", companyId: a.id },
        tripInput(a.id, { tractorUnitId: foreign.id })
      )
    ).rejects.toThrow(InvalidTripError);
  });

  it("respinge un șofer dezactivat", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    const driver = await prisma.driver.create({
      data: { companyId: company.id, firstName: "Ion", lastName: "Popescu", isActive: false },
    });

    await expect(
      createTrip(session, tripInput(company.id, { primaryDriverId: driver.id }))
    ).rejects.toThrow(InvalidTripError);
  });

  it("respinge un interval cu sfârșitul înaintea începutului", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

    await expect(
      createTrip(session, tripInput(company.id, { startsAt: d("2026-09-05"), endsAt: d("2026-09-01") }))
    ).rejects.toThrow(InvalidTripError);
  });

  it("respinge crearea pentru altă firmă", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");

    await expect(
      createTrip({ role: "COMPANY_ADMIN", companyId: a.id }, tripInput(b.id))
    ).rejects.toThrow(TenantAccessError);
  });
});
