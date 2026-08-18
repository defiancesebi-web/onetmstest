import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "../helpers/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createPasswordResetToken,
  consumePasswordResetToken,
  changeOwnPassword,
  InvalidResetTokenError,
  WrongCurrentPasswordError,
  RESET_TOKEN_TTL_MS,
} from "@/lib/data/passwordReset";

async function makeUser(email: string, password = "parola-veche-1") {
  const company = await prisma.company.create({ data: { name: "Firma A", cui: `RO${email.length}` } });
  return prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      name: "Ion Popescu",
      role: "COMPANY_ADMIN",
      companyId: company.id,
    },
  });
}

describe("createPasswordResetToken", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creează un token valabil o oră pentru un email existent", async () => {
    await makeUser("ion@test.ro");

    const token = await createPasswordResetToken("ion@test.ro");

    expect(token).not.toBeNull();
    const row = await prisma.passwordResetToken.findUniqueOrThrow({ where: { token: token! } });
    expect(row.usedAt).toBeNull();
    const ttl = row.expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(RESET_TOKEN_TTL_MS - 60_000);
    expect(ttl).toBeLessThanOrEqual(RESET_TOKEN_TTL_MS);
  });

  it("returnează null pentru un email inexistent, fără să arunce", async () => {
    expect(await createPasswordResetToken("nimeni@test.ro")).toBeNull();
  });

  it("nu creează token pentru un cont dezactivat", async () => {
    const user = await makeUser("ion@test.ro");
    await prisma.user.update({ where: { id: user.id }, data: { status: "DISABLED" } });

    expect(await createPasswordResetToken("ion@test.ro")).toBeNull();
  });

  it("invalidează tokenurile anterioare ale aceluiași utilizator", async () => {
    await makeUser("ion@test.ro");

    const first = await createPasswordResetToken("ion@test.ro");
    const second = await createPasswordResetToken("ion@test.ro");

    await expect(
      consumePasswordResetToken(first!, "parola-noua-1")
    ).rejects.toThrow(InvalidResetTokenError);
    await expect(consumePasswordResetToken(second!, "parola-noua-1")).resolves.toBeDefined();
  });

  it("ignoră diferențele de majuscule în email", async () => {
    await makeUser("ion@test.ro");

    expect(await createPasswordResetToken("ION@Test.RO")).not.toBeNull();
  });
});

describe("consumePasswordResetToken", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("schimbă parola și marchează tokenul ca folosit", async () => {
    const user = await makeUser("ion@test.ro");
    const token = await createPasswordResetToken("ion@test.ro");

    const updated = await consumePasswordResetToken(token!, "parola-noua-1");

    expect(updated.id).toBe(user.id);
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword("parola-noua-1", fresh.passwordHash)).toBe(true);
    expect(await verifyPassword("parola-veche-1", fresh.passwordHash)).toBe(false);

    const row = await prisma.passwordResetToken.findUniqueOrThrow({ where: { token: token! } });
    expect(row.usedAt).toBeInstanceOf(Date);
  });

  it("respinge un token inexistent", async () => {
    await expect(
      consumePasswordResetToken("token-inventat", "parola-noua-1")
    ).rejects.toThrow(InvalidResetTokenError);
  });

  it("respinge un token deja folosit", async () => {
    await makeUser("ion@test.ro");
    const token = await createPasswordResetToken("ion@test.ro");
    await consumePasswordResetToken(token!, "parola-noua-1");

    await expect(
      consumePasswordResetToken(token!, "alta-parola-1")
    ).rejects.toThrow(InvalidResetTokenError);
  });

  it("respinge un token expirat", async () => {
    const user = await makeUser("ion@test.ro");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: "token-expirat",
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    await expect(
      consumePasswordResetToken("token-expirat", "parola-noua-1")
    ).rejects.toThrow(InvalidResetTokenError);
  });

  it("nu lasă un cont dezactivat să-și reseteze parola", async () => {
    const user = await makeUser("ion@test.ro");
    const token = await createPasswordResetToken("ion@test.ro");
    await prisma.user.update({ where: { id: user.id }, data: { status: "DISABLED" } });

    await expect(
      consumePasswordResetToken(token!, "parola-noua-1")
    ).rejects.toThrow(InvalidResetTokenError);
  });
});

describe("changeOwnPassword", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("schimbă parola când cea veche e corectă", async () => {
    const user = await makeUser("ion@test.ro");

    await changeOwnPassword(user.id, "parola-veche-1", "parola-noua-1");

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword("parola-noua-1", fresh.passwordHash)).toBe(true);
  });

  it("respinge o parolă veche greșită", async () => {
    const user = await makeUser("ion@test.ro");

    await expect(
      changeOwnPassword(user.id, "gresita", "parola-noua-1")
    ).rejects.toThrow(WrongCurrentPasswordError);

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword("parola-veche-1", fresh.passwordHash)).toBe(true);
  });

  it("invalidează tokenurile de resetare în așteptare", async () => {
    const user = await makeUser("ion@test.ro");
    const token = await createPasswordResetToken("ion@test.ro");

    await changeOwnPassword(user.id, "parola-veche-1", "parola-noua-1");

    await expect(
      consumePasswordResetToken(token!, "parola-a-treia-1")
    ).rejects.toThrow(InvalidResetTokenError);
  });
});
