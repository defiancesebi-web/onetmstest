import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const cui = process.argv[2];
  if (!cui) {
    console.error("Utilizare: npx tsx scripts/deleteCompany.ts <CUI>");
    process.exit(1);
  }

  const company = await prisma.company.findFirst({ where: { cui } });
  if (!company) {
    console.error(`Nicio firmă cu CUI ${cui}.`);
    process.exit(1);
  }

  await prisma.$transaction([
    prisma.invitation.deleteMany({ where: { companyId: company.id } }),
    prisma.user.deleteMany({ where: { companyId: company.id } }),
    prisma.company.delete({ where: { id: company.id } }),
  ]);

  console.log(`Firma ${company.name} (${cui}) a fost ștearsă.`);
  await prisma.$disconnect();
}

main();
