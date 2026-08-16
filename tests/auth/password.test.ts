import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("verifică o parolă corectă contra hash-ului ei", async () => {
    const hash = await hashPassword("parola-mea-123");
    expect(await verifyPassword("parola-mea-123", hash)).toBe(true);
  });

  it("respinge o parolă greșită", async () => {
    const hash = await hashPassword("parola-mea-123");
    expect(await verifyPassword("alta-parola", hash)).toBe(false);
  });

  it("nu stochează parola în clar în hash", async () => {
    const hash = await hashPassword("parola-mea-123");
    expect(hash).not.toContain("parola-mea-123");
  });
});
