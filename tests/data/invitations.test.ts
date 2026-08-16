import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import { createInvitation, acceptInvitation, InvalidInvitationError } from "@/lib/data/invitations";
import { TenantAccessError } from "@/lib/tenancy";

describe("createInvitation", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creează o invitație validă 7 zile", async () => {
    const company = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };

    const invitation = await createInvitation(session, {
      companyId: company.id,
      email: "coleg@test.ro",
      role: "COMPANY_USER",
    });

    expect(invitation.status).toBe("PENDING");
    expect(invitation.token).toHaveLength(64);
    const daysUntilExpiry = (invitation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(daysUntilExpiry).toBeGreaterThan(6.9);
    expect(daysUntilExpiry).toBeLessThan(7.1);
  });

  it("respinge invitarea pentru o altă firmă decât cea din sesiune", async () => {
    const companyA = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });
    const companyB = await prisma.company.create({ data: { name: "Firma B", cui: "RO2" } });
    const session = { role: "COMPANY_ADMIN" as const, companyId: companyA.id };

    await expect(
      createInvitation(session, { companyId: companyB.id, email: "x@test.ro", role: "COMPANY_USER" })
    ).rejects.toThrow(TenantAccessError);
  });
});

describe("acceptInvitation", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creează un utilizator activ și marchează invitația ca acceptată", async () => {
    const company = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    const invitation = await createInvitation(session, {
      companyId: company.id,
      email: "coleg@test.ro",
      role: "COMPANY_USER",
    });

    const user = await acceptInvitation(invitation.token, { name: "Coleg Nou", password: "parola123" });

    expect(user.email).toBe("coleg@test.ro");
    expect(user.role).toBe("COMPANY_USER");
    expect(user.status).toBe("ACTIVE");

    const updated = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(updated.status).toBe("ACCEPTED");
  });

  it("respinge un token inexistent", async () => {
    await expect(acceptInvitation("token-invalid", { name: "X", password: "parola123" })).rejects.toThrow(
      InvalidInvitationError
    );
  });

  it("respinge o invitație deja acceptată", async () => {
    const company = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });
    const session = { role: "COMPANY_ADMIN" as const, companyId: company.id };
    const invitation = await createInvitation(session, {
      companyId: company.id,
      email: "coleg@test.ro",
      role: "COMPANY_USER",
    });

    await acceptInvitation(invitation.token, { name: "Coleg", password: "parola123" });

    await expect(acceptInvitation(invitation.token, { name: "Coleg", password: "altaparola" })).rejects.toThrow(
      InvalidInvitationError
    );
  });

  it("respinge o invitație expirată", async () => {
    const company = await prisma.company.create({ data: { name: "Firma A", cui: "RO1" } });
    const invitation = await prisma.invitation.create({
      data: {
        email: "coleg@test.ro",
        companyId: company.id,
        role: "COMPANY_USER",
        token: "token-expirat",
        expiresAt: new Date(Date.now() - 1000),
        status: "PENDING",
      },
    });

    await expect(
      acceptInvitation(invitation.token, { name: "Coleg", password: "parola123" })
    ).rejects.toThrow(InvalidInvitationError);
  });
});
