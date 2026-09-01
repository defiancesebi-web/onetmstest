import { prisma } from "@/lib/prisma";
import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";

export async function getUsersForCompany(session: SessionUser, companyId: string) {
  assertCompanyAccess(session, companyId);
  return prisma.user.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } });
}

export type MyProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  jobTitle: string | null;
  role: string;
};

/** The signed-in user's own profile (by their session id). */
export async function getMyProfile(userId: string): Promise<MyProfile | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, phone: true, avatar: true, jobTitle: true, role: true },
  });
  return u ?? null;
}

/** The user edits their OWN name, phone and avatar. Never role or jobTitle. */
export async function updateMyProfile(
  userId: string,
  input: { name: string; phone: string | null; avatar: string | null }
) {
  const name = input.name.trim();
  if (!name) throw new Error("Numele este obligatoriu.");
  return prisma.user.update({
    where: { id: userId },
    data: { name, phone: input.phone, avatar: input.avatar },
  });
}

export class ForbiddenError extends Error {
  constructor() {
    super("Doar administratorul firmei poate seta funcția.");
    this.name = "ForbiddenError";
  }
}

/**
 * The job title (function in the company) is set ONLY by a company admin, for a
 * member of their own company. Deliberately separate from the permission role.
 */
export async function setMemberJobTitle(
  session: SessionUser,
  userId: string,
  jobTitle: string | null
) {
  if (session.role !== "COMPANY_ADMIN" || !session.companyId) throw new ForbiddenError();
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } });
  if (!target || target.companyId !== session.companyId) throw new ForbiddenError();
  return prisma.user.update({
    where: { id: userId },
    data: { jobTitle: jobTitle?.trim() || null },
  });
}
