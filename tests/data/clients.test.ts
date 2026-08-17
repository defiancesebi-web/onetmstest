import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import {
  listClients,
  getClientById,
  createClient,
  updateClient,
  setClientActive,
  DuplicateCuiError,
  ClientNotFoundError,
} from "@/lib/data/clients";
import { TenantAccessError } from "@/lib/tenancy";

async function makeCompany(name: string, cui: string) {
  return prisma.company.create({ data: { name, cui } });
}

const baseInput = {
  name: "Marfa Rapida SRL",
  cui: "RO111",
  address: "Str. Depozitelor 1",
  city: "Ploiești",
};

describe("createClient", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creează un client activ cu termen de plată implicit 45", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

    const client = await createClient(session, { ...baseInput, companyId: company.id });

    expect(client.isActive).toBe(true);
    expect(client.paymentTermDays).toBe(45);
    expect(client.country).toBe("România");
    expect(client.companyId).toBe(company.id);
  });

  it("respinge crearea unui client pentru altă firmă", async () => {
    const companyA = await makeCompany("Firma A", "RO1");
    const companyB = await makeCompany("Firma B", "RO2");
    const session = { role: "COMPANY_ADMIN" as const, companyId: companyA.id };

    await expect(
      createClient(session, { ...baseInput, companyId: companyB.id })
    ).rejects.toThrow(TenantAccessError);
  });

  it("respinge un CUI deja folosit în aceeași firmă, fără confirmare", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    await createClient(session, { ...baseInput, companyId: company.id });

    await expect(
      createClient(session, { ...baseInput, companyId: company.id, name: "Alt nume" })
    ).rejects.toThrow(DuplicateCuiError);
  });

  it("acceptă CUI duplicat când se confirmă explicit", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    await createClient(session, { ...baseInput, companyId: company.id });

    const second = await createClient(session, {
      ...baseInput,
      companyId: company.id,
      name: "Alt nume",
      confirmDuplicateCui: true,
    });

    expect(second.name).toBe("Alt nume");
  });

  it("permite același CUI în firme diferite fără confirmare", async () => {
    const companyA = await makeCompany("Firma A", "RO1");
    const companyB = await makeCompany("Firma B", "RO2");

    await createClient(
      { role: "COMPANY_ADMIN", companyId: companyA.id },
      { ...baseInput, companyId: companyA.id }
    );
    const clientB = await createClient(
      { role: "COMPANY_ADMIN", companyId: companyB.id },
      { ...baseInput, companyId: companyB.id }
    );

    expect(clientB.companyId).toBe(companyB.id);
  });
});

describe("listClients", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează doar clienții firmei cerute", async () => {
    const companyA = await makeCompany("Firma A", "RO1");
    const companyB = await makeCompany("Firma B", "RO2");

    await createClient(
      { role: "COMPANY_ADMIN", companyId: companyA.id },
      { ...baseInput, companyId: companyA.id, name: "Client A" }
    );
    await createClient(
      { role: "COMPANY_ADMIN", companyId: companyB.id },
      { ...baseInput, companyId: companyB.id, name: "Client B" }
    );

    const result = await listClients(
      { role: "COMPANY_ADMIN", companyId: companyA.id },
      companyA.id
    );

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Client A");
  });

  it("respinge o cerere pentru altă firmă", async () => {
    const companyA = await makeCompany("Firma A", "RO1");
    const companyB = await makeCompany("Firma B", "RO2");

    await expect(
      listClients({ role: "COMPANY_ADMIN", companyId: companyA.id }, companyB.id)
    ).rejects.toThrow(TenantAccessError);
  });

  it("ascunde clienții inactivi implicit și îi arată la cerere", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    const client = await createClient(session, { ...baseInput, companyId: company.id });
    await setClientActive(session, client.id, false);

    expect(await listClients(session, company.id)).toHaveLength(0);
    expect(await listClients(session, company.id, { includeInactive: true })).toHaveLength(1);
  });

  it("caută după nume și după CUI", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    await createClient(session, { ...baseInput, companyId: company.id, name: "Alfa Trans", cui: "RO999" });
    await createClient(session, { ...baseInput, companyId: company.id, name: "Beta Log", cui: "RO888" });

    expect(await listClients(session, company.id, { search: "alfa" })).toHaveLength(1);
    expect(await listClients(session, company.id, { search: "888" })).toHaveLength(1);
  });
});

describe("getClientById", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează null pentru un client din altă firmă, fără să arunce", async () => {
    const companyA = await makeCompany("Firma A", "RO1");
    const companyB = await makeCompany("Firma B", "RO2");
    const clientB = await createClient(
      { role: "COMPANY_ADMIN", companyId: companyB.id },
      { ...baseInput, companyId: companyB.id }
    );

    const result = await getClientById(
      { role: "COMPANY_ADMIN", companyId: companyA.id },
      clientB.id
    );

    expect(result).toBeNull();
  });
});

describe("updateClient", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("respinge modificarea unui client din altă firmă", async () => {
    const companyA = await makeCompany("Firma A", "RO1");
    const companyB = await makeCompany("Firma B", "RO2");
    const clientB = await createClient(
      { role: "COMPANY_ADMIN", companyId: companyB.id },
      { ...baseInput, companyId: companyB.id }
    );

    await expect(
      updateClient({ role: "COMPANY_ADMIN", companyId: companyA.id }, clientB.id, {
        name: "Furat",
      })
    ).rejects.toThrow(TenantAccessError);
  });

  it("respinge modificarea unui client inexistent cu o eroare în română", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

    await expect(
      updateClient(session, "id-inexistent", { name: "Oricine" })
    ).rejects.toThrow(ClientNotFoundError);
  });
});

describe("setClientActive", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("respinge dezactivarea unui client din altă firmă", async () => {
    const companyA = await makeCompany("Firma A", "RO1");
    const companyB = await makeCompany("Firma B", "RO2");
    const clientB = await createClient(
      { role: "COMPANY_ADMIN", companyId: companyB.id },
      { ...baseInput, companyId: companyB.id }
    );

    await expect(
      setClientActive({ role: "COMPANY_ADMIN", companyId: companyA.id }, clientB.id, false)
    ).rejects.toThrow(TenantAccessError);
  });

  it("respinge dezactivarea unui client inexistent cu o eroare în română", async () => {
    const company = await makeCompany("Firma A", "RO1");
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

    await expect(
      setClientActive(session, "id-inexistent", false)
    ).rejects.toThrow(ClientNotFoundError);
  });
});
