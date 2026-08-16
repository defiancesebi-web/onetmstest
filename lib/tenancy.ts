import type { UserRole } from "@/lib/generated/prisma/enums";

export class TenantAccessError extends Error {
  constructor() {
    super("Cross-tenant access denied");
    this.name = "TenantAccessError";
  }
}

export type SessionUser = {
  role: UserRole;
  companyId: string | null;
};

export function assertCompanyAccess(session: SessionUser, targetCompanyId: string): void {
  if (session.role === "SUPER_ADMIN") return;
  if (session.companyId !== targetCompanyId) {
    throw new TenantAccessError();
  }
}
