import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import { getUsersForCompany } from "@/lib/data/users";
import { TenantAccessError } from "@/lib/tenancy";

describe("getUsersForCompany", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returnează doar utilizatorii firmei cerute, nu și pe ai altei firme", async () => {
    const companyA = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });
    const companyB = await prisma.company.create({ data: { name: "Firma B", cui: "RO2" } });

    await prisma.user.create({
      data: { email: "admin-a@test.ro", passwordHash: "x", name: "Admin A", role: "COMPANY_ADMIN", companyId: companyA.id },
    });
    await prisma.user.create({
      data: { email: "admin-b@test.ro", passwordHash: "x", name: "Admin B", role: "COMPANY_ADMIN", companyId: companyB.id },
    });

    const session = { role: "COMPANY_ADMIN" as const, companyId: companyA.id };
    const result = await getUsersForCompany(session, companyA.id);

    expect(result).toHaveLength(1);
    expect(result[0].email).toBe("admin-a@test.ro");
  });

  it("respinge o cerere pentru o altă firmă decât cea din sesiune", async () => {
    const companyA = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });
    const companyB = await prisma.company.create({ data: { name: "Firma B", cui: "RO2" } });

    const session = { role: "COMPANY_ADMIN" as const, companyId: companyA.id };

    await expect(getUsersForCompany(session, companyB.id)).rejects.toThrow(TenantAccessError);
  });

  it("permite Super Admin să vadă utilizatorii oricărei firme", async () => {
    const companyA = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });
    await prisma.user.create({
      data: { email: "admin-a@test.ro", passwordHash: "x", name: "Admin A", role: "COMPANY_ADMIN", companyId: companyA.id },
    });

    const session = { role: "SUPER_ADMIN" as const, companyId: null };
    const result = await getUsersForCompany(session, companyA.id);

    expect(result).toHaveLength(1);
  });
});
