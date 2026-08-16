import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";

export class EmailAlreadyExistsError extends Error {
  constructor() {
    super("Există deja un cont cu acest email.");
    this.name = "EmailAlreadyExistsError";
  }
}

export async function registerCompany(input: {
  companyName: string;
  cui: string;
  adminName: string;
  email: string;
  password: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new EmailAlreadyExistsError();

  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name: input.companyName, cui: input.cui, status: "TRIAL" },
    });
    const user = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.adminName,
        role: "COMPANY_ADMIN",
        companyId: company.id,
        status: "ACTIVE",
      },
    });
    return { company, user };
  });
}
