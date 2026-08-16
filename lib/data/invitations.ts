import { randomBytes } from "crypto";
import type { InvitationRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";
import { hashPassword } from "@/lib/auth/password";

export class InvalidInvitationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidInvitationError";
  }
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function createInvitation(
  session: SessionUser,
  input: { companyId: string; email: string; role: InvitationRole }
) {
  assertCompanyAccess(session, input.companyId);

  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) throw new InvalidInvitationError("Există deja un cont cu acest email.");

  const token = randomBytes(32).toString("hex");
  return prisma.invitation.create({
    data: {
      email: input.email,
      companyId: input.companyId,
      role: input.role,
      token,
      expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
      status: "PENDING",
    },
  });
}

export async function acceptInvitation(token: string, input: { name: string; password: string }) {
  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation) throw new InvalidInvitationError("Invitație inexistentă.");
  if (invitation.status !== "PENDING") throw new InvalidInvitationError("Această invitație a fost deja folosită.");
  if (invitation.expiresAt < new Date()) throw new InvalidInvitationError("Această invitație a expirat.");

  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: invitation.email,
        passwordHash,
        name: input.name,
        role: invitation.role,
        companyId: invitation.companyId,
        status: "ACTIVE",
      },
    });
    await tx.invitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED" } });
    return user;
  });
}
