import { describe, it, expect } from "vitest";
import { decideRedirect } from "@/lib/auth/routeGuard";

describe("decideRedirect", () => {
  it("trimite la /login un vizitator neautentificat care intră pe /dashboard", () => {
    expect(decideRedirect("/dashboard", null)).toBe("/login");
  });

  it("trimite la /login un vizitator neautentificat care intră pe /admin", () => {
    expect(decideRedirect("/admin", null)).toBe("/login");
  });

  it("trimite un utilizator obișnuit departe de /admin", () => {
    expect(decideRedirect("/admin", { role: "COMPANY_ADMIN" })).toBe("/dashboard");
  });

  it("trimite Super Admin departe de /dashboard, spre /admin", () => {
    expect(decideRedirect("/dashboard", { role: "SUPER_ADMIN" })).toBe("/admin");
  });

  it("nu redirecționează un Super Admin autentificat pe /admin", () => {
    expect(decideRedirect("/admin", { role: "SUPER_ADMIN" })).toBeNull();
  });

  it("nu redirecționează un utilizator obișnuit autentificat pe /dashboard", () => {
    expect(decideRedirect("/dashboard", { role: "COMPANY_USER" })).toBeNull();
  });

  it("nu afectează rute publice", () => {
    expect(decideRedirect("/login", null)).toBeNull();
  });

  it("cere autentificare pentru pagina de parolă", () => {
    expect(decideRedirect("/parola", null)).toBe("/login");
  });

  it("lasă orice rol autentificat pe pagina de parolă", () => {
    // Especially SUPER_ADMIN, who is redirected away from /dashboard and would
    // otherwise have no way to change their own password.
    expect(decideRedirect("/parola", { role: "SUPER_ADMIN" })).toBeNull();
    expect(decideRedirect("/parola", { role: "COMPANY_ADMIN" })).toBeNull();
    expect(decideRedirect("/parola", { role: "COMPANY_USER" })).toBeNull();
  });
});
