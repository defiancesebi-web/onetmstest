import { describe, it, expect } from "vitest";
import { assertCompanyAccess, TenantAccessError, type SessionUser } from "@/lib/tenancy";

describe("assertCompanyAccess", () => {
  it("permite accesul unui utilizator la propria firmă", () => {
    const session: SessionUser = { role: "COMPANY_ADMIN", companyId: "company-a" };
    expect(() => assertCompanyAccess(session, "company-a")).not.toThrow();
  });

  it("respinge accesul unui utilizator la altă firmă", () => {
    const session: SessionUser = { role: "COMPANY_ADMIN", companyId: "company-a" };
    expect(() => assertCompanyAccess(session, "company-b")).toThrow(TenantAccessError);
  });

  it("permite Super Admin să acceseze orice firmă", () => {
    const session: SessionUser = { role: "SUPER_ADMIN", companyId: null };
    expect(() => assertCompanyAccess(session, "company-b")).not.toThrow();
  });
});
