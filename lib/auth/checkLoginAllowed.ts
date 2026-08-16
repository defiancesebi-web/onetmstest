import type { CompanyModel, UserModel } from "@/lib/generated/prisma/models";

export type LoginCheckResult = { ok: true } | { ok: false; reason: string };

export function checkLoginAllowed(
  user: Pick<UserModel, "status" | "role">,
  company: Pick<CompanyModel, "status"> | null
): LoginCheckResult {
  if (user.status === "DISABLED") {
    return { ok: false, reason: "Acest cont a fost dezactivat." };
  }
  if (user.role !== "SUPER_ADMIN" && company?.status === "SUSPENDED") {
    return { ok: false, reason: "Firma ta este suspendată. Contactează administratorul." };
  }
  return { ok: true };
}
