import { prisma } from "@/lib/prisma";

export async function resetDatabase() {
  await prisma.invitation.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
}
