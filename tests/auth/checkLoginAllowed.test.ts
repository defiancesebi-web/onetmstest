import { describe, it, expect } from "vitest";
import { checkLoginAllowed } from "@/lib/auth/checkLoginAllowed";

describe("checkLoginAllowed", () => {
  it("blochează un utilizator dezactivat", () => {
    const result = checkLoginAllowed({ status: "DISABLED", role: "COMPANY_USER" }, { status: "ACTIVE" });
    expect(result.ok).toBe(false);
  });

  it("blochează un utilizator dintr-o firmă suspendată", () => {
    const result = checkLoginAllowed({ status: "ACTIVE", role: "COMPANY_USER" }, { status: "SUSPENDED" });
    expect(result.ok).toBe(false);
  });

  it("permite Super Admin indiferent de firmă", () => {
    const result = checkLoginAllowed({ status: "ACTIVE", role: "SUPER_ADMIN" }, null);
    expect(result.ok).toBe(true);
  });

  it("permite un utilizator activ dintr-o firmă activă", () => {
    const result = checkLoginAllowed({ status: "ACTIVE", role: "COMPANY_USER" }, { status: "ACTIVE" });
    expect(result.ok).toBe(true);
  });
});
