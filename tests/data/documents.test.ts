import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import {
  createDocument,
  updateDocument,
  deleteDocument,
  listDocumentsForVehicle,
  getExpiringDocuments,
  getOwnerStatuses,
  InvalidDocumentOwnerError,
  DocumentNotFoundError,
} from "@/lib/data/documents";
import { TenantAccessError } from "@/lib/tenancy";

const NOW = new Date("2026-08-18T09:00:00Z");

function dateOnly(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

async function setup(companyName: string, cui: string) {
  const company = await prisma.company.create({ data: { name: companyName, cui } });
  const vehicle = await prisma.vehicle.create({
    data: { companyId: company.id, registrationNumber: `B-1-${cui}`, type: "TRACTOR_UNIT" },
  });
  const driver = await prisma.driver.create({
    data: { companyId: company.id, firstName: "Ion", lastName: "Popescu" },
  });
  return {
    company,
    vehicle,
    driver,
    session: { role: "COMPANY_ADMIN" as const, companyId: company.id },
  };
}

describe("createDocument", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creează un document pe vehicul", async () => {
    const { vehicle, session } = await setup("Firma A", "RO1");

    const doc = await createDocument(session, {
      vehicleId: vehicle.id,
      type: "ITP",
      expiresAt: dateOnly("2026-12-31"),
    });

    expect(doc.vehicleId).toBe(vehicle.id);
    expect(doc.driverId).toBeNull();
  });

  it("creează un document pe șofer", async () => {
    const { driver, session } = await setup("Firma A", "RO1");

    const doc = await createDocument(session, {
      driverId: driver.id,
      type: "PERMIS_CONDUCERE",
      expiresAt: dateOnly("2027-01-15"),
    });

    expect(doc.driverId).toBe(driver.id);
    expect(doc.vehicleId).toBeNull();
  });

  it("respinge un document fără proprietar", async () => {
    const { session } = await setup("Firma A", "RO1");

    await expect(
      createDocument(session, { type: "ITP", expiresAt: dateOnly("2026-12-31") })
    ).rejects.toThrow(InvalidDocumentOwnerError);
  });

  it("respinge un document cu doi proprietari", async () => {
    const { vehicle, driver, session } = await setup("Firma A", "RO1");

    await expect(
      createDocument(session, {
        vehicleId: vehicle.id,
        driverId: driver.id,
        type: "ITP",
        expiresAt: dateOnly("2026-12-31"),
      })
    ).rejects.toThrow(InvalidDocumentOwnerError);
  });

  it("respinge un vehicul care aparține altei firme", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");

    await expect(
      createDocument(a.session, {
        vehicleId: b.vehicle.id,
        type: "ITP",
        expiresAt: dateOnly("2026-12-31"),
      })
    ).rejects.toThrow(TenantAccessError);
  });
});

describe("listDocumentsForVehicle", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează documentele vehiculului, sortate după expirare", async () => {
    const { vehicle, session } = await setup("Firma A", "RO1");
    await createDocument(session, { vehicleId: vehicle.id, type: "RCA", expiresAt: dateOnly("2027-01-01") });
    await createDocument(session, { vehicleId: vehicle.id, type: "ITP", expiresAt: dateOnly("2026-09-01") });

    const docs = await listDocumentsForVehicle(session, vehicle.id);

    expect(docs.map((d) => d.type)).toEqual(["ITP", "RCA"]);
  });

  it("respinge un vehicul din altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");

    await expect(listDocumentsForVehicle(a.session, b.vehicle.id)).rejects.toThrow(
      TenantAccessError
    );
  });
});

describe("getExpiringDocuments", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează expirate și cele care expiră curând, expirate primele", async () => {
    const { company, vehicle, driver, session } = await setup("Firma A", "RO1");
    await createDocument(session, { vehicleId: vehicle.id, type: "ITP", expiresAt: dateOnly("2026-08-10") });
    await createDocument(session, { driverId: driver.id, type: "AVIZ_MEDICAL", expiresAt: dateOnly("2026-08-25") });
    await createDocument(session, { vehicleId: vehicle.id, type: "RCA", expiresAt: dateOnly("2027-06-01") });

    const result = await getExpiringDocuments(session, company.id, NOW);

    expect(result.map((d) => d.type)).toEqual(["ITP", "AVIZ_MEDICAL"]);
    expect(result[0].status).toBe("EXPIRED");
    expect(result[1].status).toBe("EXPIRING_SOON");
  });

  it("exclude documentele vehiculelor inactive", async () => {
    const { company, vehicle, session } = await setup("Firma A", "RO1");
    await createDocument(session, { vehicleId: vehicle.id, type: "ITP", expiresAt: dateOnly("2026-08-10") });
    await prisma.vehicle.update({ where: { id: vehicle.id }, data: { isActive: false } });

    expect(await getExpiringDocuments(session, company.id, NOW)).toHaveLength(0);
  });

  it("exclude documentele șoferilor inactivi", async () => {
    const { company, driver, session } = await setup("Firma A", "RO1");
    await createDocument(session, { driverId: driver.id, type: "AVIZ_MEDICAL", expiresAt: dateOnly("2026-08-10") });
    await prisma.driver.update({ where: { id: driver.id }, data: { isActive: false } });

    expect(await getExpiringDocuments(session, company.id, NOW)).toHaveLength(0);
  });

  it("nu vede documentele altei firme", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");
    await createDocument(b.session, {
      vehicleId: b.vehicle.id,
      type: "ITP",
      expiresAt: dateOnly("2026-08-10"),
    });

    expect(await getExpiringDocuments(a.session, a.company.id, NOW)).toHaveLength(0);
  });

  it("respinge o cerere pentru altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");

    await expect(getExpiringDocuments(a.session, b.company.id, NOW)).rejects.toThrow(
      TenantAccessError
    );
  });

  it("identifică proprietarul în rezultat", async () => {
    const { company, vehicle, session } = await setup("Firma A", "RO1");
    await createDocument(session, { vehicleId: vehicle.id, type: "ITP", expiresAt: dateOnly("2026-08-10") });

    const [row] = await getExpiringDocuments(session, company.id, NOW);

    expect(row.ownerLabel).toBe(vehicle.registrationNumber);
    expect(row.ownerHref).toBe(`/dashboard/flota/${vehicle.id}`);
  });
});

describe("getOwnerStatuses", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("agregă cea mai gravă stare pe fiecare proprietar", async () => {
    const { company, vehicle, driver, session } = await setup("Firma A", "RO1");
    await createDocument(session, { vehicleId: vehicle.id, type: "RCA", expiresAt: dateOnly("2027-06-01") });
    await createDocument(session, { vehicleId: vehicle.id, type: "ITP", expiresAt: dateOnly("2026-08-10") });
    await createDocument(session, { driverId: driver.id, type: "AVIZ_MEDICAL", expiresAt: dateOnly("2026-08-25") });

    const statuses = await getOwnerStatuses(session, company.id, NOW);

    expect(statuses.vehicles[vehicle.id]).toBe("EXPIRED");
    expect(statuses.drivers[driver.id]).toBe("EXPIRING_SOON");
  });

  it("nu include proprietarii fără documente", async () => {
    const { company, vehicle, session } = await setup("Firma A", "RO1");

    const statuses = await getOwnerStatuses(session, company.id, NOW);

    expect(statuses.vehicles[vehicle.id]).toBeUndefined();
  });
});

describe("updateDocument și deleteDocument", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("modifică data de expirare la reînnoire", async () => {
    const { vehicle, session } = await setup("Firma A", "RO1");
    const doc = await createDocument(session, {
      vehicleId: vehicle.id,
      type: "ITP",
      expiresAt: dateOnly("2026-08-10"),
    });

    const updated = await updateDocument(session, doc.id, { expiresAt: dateOnly("2027-08-10") });

    expect(updated.expiresAt.toISOString().slice(0, 10)).toBe("2027-08-10");
  });

  it("șterge un document", async () => {
    const { vehicle, session } = await setup("Firma A", "RO1");
    const doc = await createDocument(session, {
      vehicleId: vehicle.id,
      type: "ITP",
      expiresAt: dateOnly("2026-08-10"),
    });

    await deleteDocument(session, doc.id);

    expect(await listDocumentsForVehicle(session, vehicle.id)).toHaveLength(0);
  });

  it("respinge ștergerea unui document din altă firmă", async () => {
    const a = await setup("Firma A", "RO1");
    const b = await setup("Firma B", "RO2");
    const doc = await createDocument(b.session, {
      vehicleId: b.vehicle.id,
      type: "ITP",
      expiresAt: dateOnly("2026-08-10"),
    });

    await expect(deleteDocument(a.session, doc.id)).rejects.toThrow(TenantAccessError);
  });

  it("aruncă o eroare în română pentru un id inexistent", async () => {
    const { session } = await setup("Firma A", "RO1");

    await expect(deleteDocument(session, "id-inexistent")).rejects.toThrow(DocumentNotFoundError);
  });
});
