import { prisma } from "@/lib/prisma";
import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";

export async function getUsersForCompany(session: SessionUser, companyId: string) {
  assertCompanyAccess(session, companyId);
  return prisma.user.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } });
}
