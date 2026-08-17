import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import {
  listVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  setVehicleActive,
  DuplicateRegistrationError,
  VehicleNotFoundError,
} from "@/lib/data/vehicles";
import { TenantAccessError } from "@/lib/tenancy";

async function makeCompany(name: string, cui: string) {
  return prisma.company.create({ data: { name, cui } });
}

const base = { registrationNumber: "B-123-ABC", type: "TRACTOR_UNIT" as const };

describe("createVehicle", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creează un vehicul activ", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

    const vehicle = await createVehicle(session, { ...base, companyId: company.id });

    expect(vehicle.isActive).toBe(true);
    expect(vehicle.type).toBe("TRACTOR_UNIT");
    expect(vehicle.companyId).toBe(company.id);
  });

  it("acceptă toate cele patru tipuri de vehicul", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

    for (const [i, type] of (["TRACTOR_UNIT", "SEMI_TRAILER", "RIGID_TRUCK", "VAN_3_5T"] as const).entries()) {
      const v = await createVehicle(session, {
        companyId: company.id,
        registrationNumber: `B-00${i}-XYZ`,
        type,
      });
      expect(v.type).toBe(type);
    }
  });

  it("respinge un număr de înmatriculare duplicat în aceeași firmă", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    await createVehicle(session, { ...base, companyId: company.id });

    await expect(
      createVehicle(session, { ...base, companyId: company.id })
    ).rejects.toThrow(DuplicateRegistrationError);
  });

  it("permite același număr în firme diferite", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");

    await createVehicle({ role: "COMPANY_ADMIN", companyId: a.id }, { ...base, companyId: a.id });
    const vb = await createVehicle(
      { role: "COMPANY_ADMIN", companyId: b.id },
      { ...base, companyId: b.id }
    );

    expect(vb.companyId).toBe(b.id);
  });

  it("respinge crearea pentru altă firmă", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");

    await expect(
      createVehicle({ role: "COMPANY_ADMIN", companyId: a.id }, { ...base, companyId: b.id })
    ).rejects.toThrow(TenantAccessError);
  });
});

describe("listVehicles", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează doar vehiculele firmei cerute", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");
    await createVehicle({ role: "COMPANY_ADMIN", companyId: a.id }, { ...base, companyId: a.id });
    await createVehicle(
      { role: "COMPANY_ADMIN", companyId: b.id },
      { companyId: b.id, registrationNumber: "CJ-999-ZZZ", type: "RIGID_TRUCK" }
    );

    const result = await listVehicles({ role: "COMPANY_ADMIN", companyId: a.id }, a.id);

    expect(result).toHaveLength(1);
    expect(result[0].registrationNumber).toBe("B-123-ABC");
  });

  it("respinge o cerere pentru altă firmă", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");

    await expect(
      listVehicles({ role: "COMPANY_ADMIN", companyId: a.id }, b.id)
    ).rejects.toThrow(TenantAccessError);
  });

  it("ascunde vehiculele inactive implicit și le arată la cerere", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    const vehicle = await createVehicle(session, { ...base, companyId: company.id });
    await setVehicleActive(session, vehicle.id, false);

    expect(await listVehicles(session, company.id)).toHaveLength(0);
    expect(await listVehicles(session, company.id, { includeInactive: true })).toHaveLength(1);
  });

  it("caută după numărul de înmatriculare", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    await createVehicle(session, { ...base, companyId: company.id });
    await createVehicle(session, {
      companyId: company.id,
      registrationNumber: "CJ-555-QQQ",
      type: "VAN_3_5T",
    });

    expect(await listVehicles(session, company.id, { search: "123" })).toHaveLength(1);
    expect(await listVehicles(session, company.id, { search: "cj" })).toHaveLength(1);
  });
});

describe("getVehicleById", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează null pentru un vehicul din altă firmă", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");
    const vb = await createVehicle(
      { role: "COMPANY_ADMIN", companyId: b.id },
      { ...base, companyId: b.id }
    );

    expect(await getVehicleById({ role: "COMPANY_ADMIN", companyId: a.id }, vb.id)).toBeNull();
  });
});

describe("updateVehicle", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("respinge modificarea unui vehicul din altă firmă", async () => {
    const a = await makeCompany("Firma A", "RO1");
    const b = await makeCompany("Firma B", "RO2");
    const vb = await createVehicle(
      { role: "COMPANY_ADMIN", companyId: b.id },
      { ...base, companyId: b.id }
    );

    await expect(
      updateVehicle({ role: "COMPANY_ADMIN", companyId: a.id }, vb.id, { make: "Furat" })
    ).rejects.toThrow(TenantAccessError);
  });

  it("aruncă o eroare în română pentru un id inexistent", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

    await expect(updateVehicle(session, "id-inexistent", { make: "X" })).rejects.toThrow(
      VehicleNotFoundError
    );
  });
});
