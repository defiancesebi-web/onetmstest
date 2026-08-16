import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import { registerCompany, EmailAlreadyExistsError } from "@/lib/data/registerCompany";

describe("registerCompany", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creează o firmă TRIAL și un admin de firmă", async () => {
    const { company, user } = await registerCompany({
      companyName: "Transport SRL",
      cui: "RO123",
      adminName: "Ion Pop",
      email: "ion@transport.ro",
      password: "parola123",
    });

    expect(company.status).toBe("TRIAL");
    expect(user.role).toBe("COMPANY_ADMIN");
    expect(user.companyId).toBe(company.id);
    expect(user.passwordHash).not.toBe("parola123");
  });

  it("respinge un email deja folosit", async () => {
    await registerCompany({
      companyName: "Transport SRL",
      cui: "RO123",
      adminName: "Ion Pop",
      email: "ion@transport.ro",
      password: "parola123",
    });

    await expect(
      registerCompany({
        companyName: "Alta Firma SRL",
        cui: "RO999",
        adminName: "Alt Admin",
        email: "ion@transport.ro",
        password: "altaparola",
      })
    ).rejects.toThrow(EmailAlreadyExistsError);
  });
});
