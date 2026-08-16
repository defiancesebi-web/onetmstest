"use server";

import { auth } from "@/auth";
import { updateCompanyStatus } from "@/lib/data/companies";
import { revalidatePath } from "next/cache";
import type { CompanyStatus } from "@/lib/generated/prisma/enums";

export async function setCompanyStatusAction(companyId: string, status: CompanyStatus) {
  const session = await auth();
  if (!session) throw new Error("Neautentificat");

  await updateCompanyStatus({ role: session.user.role }, companyId, status);
  revalidatePath("/admin");
}
