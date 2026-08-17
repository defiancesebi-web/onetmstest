import { prisma } from "@/lib/prisma";
import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";

export class DriverNotFoundError extends Error {
  constructor() {
    super("Șoferul nu a fost găsit.");
    this.name = "DriverNotFoundError";
  }
}

export type CreateDriverInput = {
  companyId: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  personalId?: string | null;
  hiredAt?: Date | null;
  notes?: string | null;
};

export type UpdateDriverInput = Partial<Omit<CreateDriverInput, "companyId">>;

export async function listDrivers(
  session: SessionUser,
  companyId: string,
  options: { search?: string; includeInactive?: boolean } = {}
) {
  assertCompanyAccess(session, companyId);

  const search = options.search?.trim();

  return prisma.driver.findMany({
    where: {
      companyId,
      ...(options.includeInactive ? {} : { isActive: true }),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export async function getDriverById(session: SessionUser, driverId: string) {
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) return null;
  if (driver.companyId !== session.companyId) return null;
  return driver;
}

async function assertOwnDriver(session: SessionUser, driverId: string) {
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) throw new DriverNotFoundError();
  assertCompanyAccess(session, driver.companyId);
  return driver;
}

export async function createDriver(session: SessionUser, input: CreateDriverInput) {
  assertCompanyAccess(session, input.companyId);

  return prisma.driver.create({
    data: {
      companyId: input.companyId,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone ?? null,
      email: input.email ?? null,
      personalId: input.personalId ?? null,
      hiredAt: input.hiredAt ?? null,
      notes: input.notes ?? null,
    },
  });
}

export async function updateDriver(
  session: SessionUser,
  driverId: string,
  input: UpdateDriverInput
) {
  await assertOwnDriver(session, driverId);
  return prisma.driver.update({ where: { id: driverId }, data: input });
}

export async function setDriverActive(
  session: SessionUser,
  driverId: string,
  isActive: boolean
) {
  await assertOwnDriver(session, driverId);
  return prisma.driver.update({ where: { id: driverId }, data: { isActive } });
}
