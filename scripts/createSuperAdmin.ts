import "dotenv/config";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth/password";

async function main() {
  const [email, password, name] = process.argv.slice(2);

  if (!email || !password) {
    console.error("Utilizare: npx tsx scripts/createSuperAdmin.ts <email> <parola> [nume]");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`Există deja un cont cu emailul ${email}.`);
    process.exit(1);
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      name: name ?? "Super Admin",
      role: "SUPER_ADMIN",
      companyId: null,
      status: "ACTIVE",
    },
  });

  console.log(`Super Admin creat: ${user.email}`);
  await prisma.$disconnect();
}

main();
