import { prisma } from "@/lib/prisma";

export async function resetDatabase() {
  await prisma.document.deleteMany();
  await prisma.orderStop.deleteMany();
  await prisma.order.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.client.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
}
