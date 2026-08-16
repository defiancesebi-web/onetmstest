import type { CompanyStatus, UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/tenancy";

export class ForbiddenError extends Error {
  constructor() {
    super("Doar Super Admin poate face această acțiune.");
    this.name = "ForbiddenError";
  }
}

export async function getCompanyForSession(session: SessionUser) {
  if (!session.companyId) return null;
  return prisma.company.findUnique({ where: { id: session.companyId } });
}

export async function listCompaniesForSuperAdmin(session: { role: UserRole }) {
  if (session.role !== "SUPER_ADMIN") throw new ForbiddenError();
  return prisma.company.findMany({ orderBy: { createdAt: "desc" } });
}

export async function updateCompanyStatus(
  session: { role: UserRole },
  companyId: string,
  status: CompanyStatus
) {
  if (session.role !== "SUPER_ADMIN") throw new ForbiddenError();
  return prisma.company.update({ where: { id: companyId }, data: { status } });
}
