import { Prisma } from "@/lib/generated/prisma/client";
import type { VehicleType } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";

export class VehicleNotFoundError extends Error {
  constructor() {
    super("Vehiculul nu a fost găsit.");
    this.name = "VehicleNotFoundError";
  }
}

export class DuplicateRegistrationError extends Error {
  constructor(registrationNumber: string) {
    super(`Există deja un vehicul cu numărul ${registrationNumber}.`);
    this.name = "DuplicateRegistrationError";
  }
}

export type CreateVehicleInput = {
  companyId: string;
  registrationNumber: string;
  type: VehicleType;
  make?: string | null;
  model?: string | null;
  manufactureYear?: number | null;
  vin?: string | null;
  notes?: string | null;
};

export type UpdateVehicleInput = Partial<Omit<CreateVehicleInput, "companyId">>;

export async function listVehicles(
  session: SessionUser,
  companyId: string,
  options: { search?: string; includeInactive?: boolean } = {}
) {
  assertCompanyAccess(session, companyId);

  const search = options.search?.trim();

  return prisma.vehicle.findMany({
    where: {
      companyId,
      ...(options.includeInactive ? {} : { isActive: true }),
      ...(search
        ? { registrationNumber: { contains: search, mode: "insensitive" } }
        : {}),
    },
    orderBy: { registrationNumber: "asc" },
  });
}

export async function getVehicleById(session: SessionUser, vehicleId: string) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) return null;
  // Null rather than throw, so pages render 404 without revealing existence.
  if (vehicle.companyId !== session.companyId) return null;
  return vehicle;
}

async function assertOwnVehicle(session: SessionUser, vehicleId: string) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw new VehicleNotFoundError();
  assertCompanyAccess(session, vehicle.companyId);
  return vehicle;
}

export async function createVehicle(session: SessionUser, input: CreateVehicleInput) {
  assertCompanyAccess(session, input.companyId);

  try {
    return await prisma.vehicle.create({
      data: {
        companyId: input.companyId,
        registrationNumber: input.registrationNumber,
        type: input.type,
        make: input.make ?? null,
        model: input.model ?? null,
        manufactureYear: input.manufactureYear ?? null,
        vin: input.vin ?? null,
        notes: input.notes ?? null,
      },
    });
  } catch (error) {
    // The unique index on (companyId, registrationNumber) is the real guard;
    // catching P2002 turns it into a Romanian message instead of a raw error.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DuplicateRegistrationError(input.registrationNumber);
    }
    throw error;
  }
}

export async function updateVehicle(
  session: SessionUser,
  vehicleId: string,
  input: UpdateVehicleInput
) {
  await assertOwnVehicle(session, vehicleId);

  try {
    return await prisma.vehicle.update({ where: { id: vehicleId }, data: input });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DuplicateRegistrationError(input.registrationNumber ?? "");
    }
    throw error;
  }
}

export async function setVehicleActive(
  session: SessionUser,
  vehicleId: string,
  isActive: boolean
) {
  await assertOwnVehicle(session, vehicleId);
  return prisma.vehicle.update({ where: { id: vehicleId }, data: { isActive } });
}
