import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

/**
 * One hour. Invitations live seven days, but a reset link is a bearer key to an
 * existing account sitting in an inbox — the window it is useful in should be
 * the window the person is actually reading their mail.
 */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export class InvalidResetTokenError extends Error {
  constructor() {
    super("Linkul de resetare este invalid sau a expirat. Cere unul nou.");
    this.name = "InvalidResetTokenError";
  }
}

export class WrongCurrentPasswordError extends Error {
  constructor() {
    super("Parola actuală este greșită.");
    this.name = "WrongCurrentPasswordError";
  }
}

/**
 * Returns the token for an eligible account, or `null` for everything else —
 * unknown address, disabled account. Callers MUST show the same message either
 * way, or this becomes a way to discover which addresses have accounts.
 */
export async function createPasswordResetToken(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!user || user.status === "DISABLED") return null;

  const token = randomBytes(32).toString("hex");

  // Issuing a new link retires the older ones: a person who clicks "forgot
  // password" three times should not leave three working keys behind.
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    }),
  ]);

  return token;
}

export async function consumePasswordResetToken(token: string, newPassword: string) {
  const row = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  // Every rejection reason raises the same error: an attacker holding a guessed
  // token learns nothing from being told whether it expired or never existed.
  if (!row || row.usedAt || row.expiresAt < new Date()) throw new InvalidResetTokenError();
  if (row.user.status === "DISABLED") throw new InvalidResetTokenError();

  const passwordHash = await hashPassword(newPassword);

  return prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
    return tx.user.update({
      where: { id: row.userId },
      data: { passwordHash },
    });
  });
}

export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const currentOk = await verifyPassword(currentPassword, user.passwordHash);
  if (!currentOk) throw new WrongCurrentPasswordError();

  const passwordHash = await hashPassword(newPassword);

  return prisma.$transaction(async (tx) => {
    // A deliberate password change also retires any reset link already in the
    // person's inbox — otherwise an old link could undo the change later.
    await tx.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    return tx.user.update({ where: { id: userId }, data: { passwordHash } });
  });
}
