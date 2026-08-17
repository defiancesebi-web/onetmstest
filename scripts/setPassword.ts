import "dotenv/config";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth/password";

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Utilizare: npx tsx scripts/setPassword.ts <email> <parola>");
    process.exit(1);
  }

  const user = await prisma.user.update({
    where: { email },
    data: { passwordHash: await hashPassword(password) },
  });

  console.log(`Parolă schimbată pentru ${user.email}.`);
  await prisma.$disconnect();
}

main();
