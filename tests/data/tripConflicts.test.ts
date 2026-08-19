import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import {
  createTrip,
  listTrips,
  getTripById,
  updateTripResources,
  updateTripDates,
  findResourceConflicts,
  InvalidTripError,
} from "@/lib/data/trips";
import { TenantAccessError } from "@/lib/tenancy";

function d(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

async function setup(name: string, cui: string) {
  const company = await prisma.company.create({ data: { name, cui } });
  const tractor = await prisma.vehicle.create({
    data: { companyId: company.id, registrationNumber: `B-1-${cui}`, type: "TRACTOR_UNIT" },
  });
  const driver = await prisma.driver.create({
    data: { companyId: company.id, firstName: "Ion", lastName: "Popescu" },
  });
  return {
    company,
    tractor,
    driver,
    session: { role: "COMPANY_ADMIN" as const, companyId: company.id },
  };
}

describe("findResourceConflicts", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("semnalează un cap tractor deja ocupat în interval", async () => {
    const { company, tractor, session } = await setup("Firma A", "RO1");
    const existing = await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-05"),
      tractorUnitId: tractor.id,
    });

    const conflicts = await findResourceConflicts(session, company.id, {
      startsAt: d("2026-09-04"),
      endsAt: d("2026-09-08"),
      tractorUnitId: tractor.id,
    });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].tripNumber).toBe(existing.tripNumber);
    expect(conflicts[0].resource).toBe("tractorUnit");
  });

  it("semnalează suprapunerea și când cursele se ating într-o zi", async () => {
    const { company, tractor, session } = await setup("Firma A", "RO1");
    await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-05"),
      tractorUnitId: tractor.id,
    });

    const conflicts = await findResourceConflicts(session, company.id, {
      startsAt: d("2026-09-05"),
      endsAt: d("2026-09-09"),
      tractorUnitId: tractor.id,
    });

    expect(conflicts).toHaveLength(1);
  });

  it("semnalează suprapunerea și când noua cursă se termină chiar în ziua în care începe cea existentă", async () => {
    const { company, tractor, session } = await setup("Firma A", "RO1");
    await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-05"),
      endsAt: d("2026-09-09"),
      tractorUnitId: tractor.id,
    });

    const conflicts = await findResourceConflicts(session, company.id, {
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-05"),
      tractorUnitId: tractor.id,
    });

    expect(conflicts).toHaveLength(1);
  });

  it("nu semnalează curse consecutive", async () => {
    const { company, tractor, session } = await setup("Firma A", "RO1");
    await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-05"),
      tractorUnitId: tractor.id,
    });

    const conflicts = await findResourceConflicts(session, company.id, {
      startsAt: d("2026-09-06"),
      endsAt: d("2026-09-09"),
      tractorUnitId: tractor.id,
    });

    expect(conflicts).toHaveLength(0);
  });

  it("ignoră cursele anulate", async () => {
    const { company, tractor, session } = await setup("Firma A", "RO1");
    const existing = await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-05"),
      tractorUnitId: tractor.id,
    });
    await prisma.trip.update({ where: { id: existing.id }, data: { status: "CANCELLED" } });

    const conflicts = await findResourceConflicts(session, company.id, {
      startsAt: d("2026-09-02"),
      endsAt: d("2026-09-03"),
      tractorUnitId: tractor.id,
    });

    expect(conflicts).toHaveLength(0);
  });

  it("se exclude pe sine când se editează o cursă existentă", async () => {
    const { company, tractor, session } = await setup("Firma A", "RO1");
    const trip = await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-05"),
      tractorUnitId: tractor.id,
    });

    const conflicts = await findResourceConflicts(session, company.id, {
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-05"),
      tractorUnitId: tractor.id,
      excludeTripId: trip.id,
    });

    expect(conflicts).toHaveLength(0);
  });

  it("semnalează un șofer ocupat, indiferent pe ce poziție era", async () => {
    const { company, driver, session } = await setup("Firma A", "RO1");
    await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-05"),
      secondDriverId: driver.id,
    });

    const conflicts = await findResourceConflicts(session, company.id, {
      startsAt: d("2026-09-03"),
      endsAt: d("2026-09-07"),
      primaryDriverId: driver.id,
    });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].resource).toBe("primaryDriver");
  });

  it("semnalează un șofer ocupat și în sensul invers: primar existent vs. secund cerut", async () => {
    const { company, driver, session } = await setup("Firma A", "RO1");
    await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-05"),
      primaryDriverId: driver.id,
    });

    const conflicts = await findResourceConflicts(session, company.id, {
      startsAt: d("2026-09-03"),
      endsAt: d("2026-09-07"),
      secondDriverId: driver.id,
    });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].resource).toBe("secondDriver");
  });

  it("nu vede cursele altei firme", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");
    await createTrip(b.session, {
      companyId: b.company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-05"),
      tractorUnitId: b.tractor.id,
    });

    const conflicts = await findResourceConflicts(a.session, a.company.id, {
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-05"),
      tractorUnitId: b.tractor.id,
    });

    expect(conflicts).toHaveLength(0);
  });

  it("respinge o cerere pentru altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");

    await expect(
      findResourceConflicts(a.session, b.company.id, {
        startsAt: d("2026-09-01"),
        endsAt: d("2026-09-05"),
      })
    ).rejects.toThrow(TenantAccessError);
  });
});

describe("listTrips și getTripById", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează doar cursele firmei cerute", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");
    await createTrip(a.session, { companyId: a.company.id, startsAt: d("2026-09-01"), endsAt: d("2026-09-02") });
    await createTrip(b.session, { companyId: b.company.id, startsAt: d("2026-09-01"), endsAt: d("2026-09-02") });

    expect(await listTrips(a.session, a.company.id)).toHaveLength(1);
  });

  it("filtrează după stare", async () => {
    const a = await setup("Firma A", "RO1");
    await createTrip(a.session, { companyId: a.company.id, startsAt: d("2026-09-01"), endsAt: d("2026-09-02") });

    expect(await listTrips(a.session, a.company.id, { status: "PLANNED" })).toHaveLength(1);
    expect(await listTrips(a.session, a.company.id, { status: "COMPLETED" })).toHaveLength(0);
  });

  it("returnează null pentru o cursă din altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");
    const tripB = await createTrip(b.session, {
      companyId: b.company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-02"),
    });

    expect(await getTripById(a.session, tripB.id)).toBeNull();
  });
});

describe("updateTripResources și updateTripDates", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("schimbă resursele alocate", async () => {
    const { company, tractor, session } = await setup("Firma A", "RO1");
    const trip = await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-02"),
    });

    const updated = await updateTripResources(session, trip.id, { tractorUnitId: tractor.id });

    expect(updated.tractorUnitId).toBe(tractor.id);
  });

  it("respinge modificarea unei curse din altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");
    const tripB = await createTrip(b.session, {
      companyId: b.company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-02"),
    });

    await expect(
      updateTripResources(a.session, tripB.id, { tractorUnitId: a.tractor.id })
    ).rejects.toThrow(TenantAccessError);
  });

  it("respinge modificarea datelor unei curse din altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");
    const tripB = await createTrip(b.session, {
      companyId: b.company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-02"),
    });

    await expect(
      updateTripDates(a.session, tripB.id, d("2026-09-01"), d("2026-09-03"))
    ).rejects.toThrow(TenantAccessError);
  });

  it("marchează intervalul ca editat manual, ca să nu mai fie recalculat", async () => {
    const { company, session } = await setup("Firma A", "RO1");
    const trip = await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-02"),
    });

    const updated = await updateTripDates(session, trip.id, d("2026-09-01"), d("2026-09-06"));

    expect(updated.datesEditedManually).toBe(true);
    expect(updated.endsAt.toISOString().slice(0, 10)).toBe("2026-09-06");
  });

  it("respinge un interval inversat", async () => {
    const { company, session } = await setup("Firma A", "RO1");
    const trip = await createTrip(session, {
      companyId: company.id,
      startsAt: d("2026-09-01"),
      endsAt: d("2026-09-02"),
    });

    await expect(
      updateTripDates(session, trip.id, d("2026-09-05"), d("2026-09-01"))
    ).rejects.toThrow(InvalidTripError);
  });
});
