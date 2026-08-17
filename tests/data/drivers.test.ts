import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import {
  listDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  setDriverActive,
  DriverNotFoundError,
} from "@/lib/data/drivers";
import { TenantAccessError } from "@/lib/tenancy";

async function makeCompany(name: string, cui: string) {
  return prisma.company.create({ data: { name, cui } });
}

const base = { firstName: "Ion", lastName: "Popescu" };

describe("createDriver", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creează un șofer activ", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

    const driver = await createDriver(session, { ...base, companyId: company.id });

    expect(driver.isActive).toBe(true);
    expect(driver.lastName).toBe("Popescu");
    expect(driver.personalId).toBeNull();
  });

  it("respinge crearea pentru altă firmă", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");

    await expect(
      createDriver({ role: "COMPANY_ADMIN", companyId: a.id }, { ...base, companyId: b.id })
    ).rejects.toThrow(TenantAccessError);
  });
});

describe("listDrivers", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează doar șoferii firmei cerute", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");
    await createDriver({ role: "COMPANY_ADMIN", companyId: a.id }, { ...base, companyId: a.id });
    await createDriver(
      { role: "COMPANY_ADMIN", companyId: b.id },
      { companyId: b.id, firstName: "Vasile", lastName: "Ionescu" }
    );

    const result = await listDrivers({ role: "COMPANY_ADMIN", companyId: a.id }, a.id);

    expect(result).toHaveLength(1);
    expect(result[0].lastName).toBe("Popescu");
  });

  it("respinge o cerere pentru altă firmă", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");

    await expect(
      listDrivers({ role: "COMPANY_ADMIN", companyId: a.id }, b.id)
    ).rejects.toThrow(TenantAccessError);
  });

  it("ascunde șoferii inactivi implicit și îi arată la cerere", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    const driver = await createDriver(session, { ...base, companyId: company.id });
    await setDriverActive(session, driver.id, false);

    expect(await listDrivers(session, company.id)).toHaveLength(0);
    expect(await listDrivers(session, company.id, { includeInactive: true })).toHaveLength(1);
  });

  it("caută după nume și prenume", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    await createDriver(session, { ...base, companyId: company.id });
    await createDriver(session, {
      companyId: company.id,
      firstName: "Vasile",
      lastName: "Georgescu",
    });

    expect(await listDrivers(session, company.id, { search: "popescu" })).toHaveLength(1);
    expect(await listDrivers(session, company.id, { search: "vasile" })).toHaveLength(1);
  });
});

describe("getDriverById", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează null pentru un șofer din altă firmă", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");
    const db = await createDriver(
      { role: "COMPANY_ADMIN", companyId: b.id },
      { ...base, companyId: b.id }
    );

    expect(await getDriverById({ role: "COMPANY_ADMIN", companyId: a.id }, db.id)).toBeNull();
  });
});

describe("updateDriver", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("respinge modificarea unui șofer din altă firmă", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");
    const db = await createDriver(
      { role: "COMPANY_ADMIN", companyId: b.id },
      { ...base, companyId: b.id }
    );

    await expect(
      updateDriver({ role: "COMPANY_ADMIN", companyId: a.id }, db.id, { phone: "0700" })
    ).rejects.toThrow(TenantAccessError);
  });

  it("aruncă o eroare în română pentru un id inexistent", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

    await expect(updateDriver(session, "id-inexistent", { phone: "0700" })).rejects.toThrow(
      DriverNotFoundError
    );
  });
});
