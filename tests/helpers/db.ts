import { prisma } from "@/lib/prisma";

export async function resetDatabase() {
  await prisma.orderStop.deleteMany();
  await prisma.order.deleteMany();
  await prisma.client.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
}
