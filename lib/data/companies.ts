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

export type InvoicingSettingsInput = {
  regCom: string | null;
  address: string | null;
  city: string | null;
  county: string | null;
  postalCode: string | null;
  iban: string | null;
  bankName: string | null;
  vatPayer: boolean;
  invoiceSeries: string | null;
};

/**
 * The company edits only its OWN invoicing identity, and only a company admin
 * may. Scoped to session.companyId so one tenant can never write another's
 * legal details. Status/name/CUI stay off-limits here — those are the platform
 * owner's to set from the admin area.
 */
export async function updateCompanyInvoicingSettings(
  session: SessionUser,
  input: InvoicingSettingsInput
) {
  if (session.role !== "COMPANY_ADMIN" || !session.companyId) throw new ForbiddenError();
  return prisma.company.update({
    where: { id: session.companyId },
    data: {
      regCom: input.regCom,
      address: input.address,
      city: input.city,
      county: input.county,
      postalCode: input.postalCode,
      iban: input.iban,
      bankName: input.bankName,
      vatPayer: input.vatPayer,
      invoiceSeries: input.invoiceSeries,
    },
  });
}
