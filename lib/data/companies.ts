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

export type CompanySettingsInput = {
  regCom: string | null;
  address: string | null;
  city: string | null;
  county: string | null;
  postalCode: string | null;
  iban: string | null;
  bankName: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  shareCapital: string | null;
  vatPayer: boolean;
  invoiceSeries: string | null;
  /** Square image data URL, or null to clear. Validated by the caller. */
  logo: string | null;
};

/**
 * The company edits only its OWN identity/invoicing details, and only a company
 * admin may. Scoped to session.companyId so one tenant can never write
 * another's data. Status/name/CUI stay off-limits here — those are the platform
 * owner's to set from the admin area.
 */
export async function updateCompanySettings(session: SessionUser, input: CompanySettingsInput) {
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
      phone: input.phone,
      email: input.email,
      website: input.website,
      shareCapital: input.shareCapital,
      vatPayer: input.vatPayer,
      invoiceSeries: input.invoiceSeries,
      logo: input.logo,
    },
  });
}
