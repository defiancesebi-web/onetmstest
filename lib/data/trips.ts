import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";
import { formatTripNumber } from "@/lib/tripStatus";
// Reused rather than duplicated: the helper is order-flavoured in name only —
// it returns the current calendar year in Europe/Bucharest, which is what trip
// numbering needs too.
import { currentOrderYear } from "@/lib/data/orders";

export class TripNotFoundError extends Error {
  constructor() {
    super("Cursa nu a fost găsită.");
    this.name = "TripNotFoundError";
  }
}

export class InvalidTripError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTripError";
  }
}

export class TripNumberingError extends Error {
  constructor() {
    super("Nu s-a putut aloca un număr de cursă. Încearcă din nou.");
    this.name = "TripNumberingError";
  }
}

export type TripResourceInput = {
  tractorUnitId?: string | null;
  trailerId?: string | null;
  primaryDriverId?: string | null;
  secondDriverId?: string | null;
};

export type CreateTripInput = TripResourceInput & {
  companyId: string;
  startsAt: Date;
  endsAt: Date;
  notes?: string | null;
};

// Mirrors the budget in lib/data/orders.ts: the advisory lock below is the real
// serialization, and the two unique constraints are the real guard. This retry
// is a defensive backstop.
export const MAX_TRIP_NUMBERING_ATTEMPTS = 3;

/**
 * Proves every supplied resource belongs to this company and is still active.
 * Inactive ones are rejected on the server, not merely hidden in the UI — a
 * stale page could otherwise assign a truck that was sold this morning.
 */
export async function assertResourcesUsable(
  companyId: string,
  input: TripResourceInput
): Promise<void> {
  const vehicleIds = [input.tractorUnitId, input.trailerId].filter(
    (id): id is string => Boolean(id)
  );
  const driverIds = [input.primaryDriverId, input.secondDriverId].filter(
    (id): id is string => Boolean(id)
  );

  if (
    input.primaryDriverId &&
    input.secondDriverId &&
    input.primaryDriverId === input.secondDriverId
  ) {
    throw new InvalidTripError("Cei doi șoferi nu pot fi aceeași persoană.");
  }

  if (input.tractorUnitId && input.tractorUnitId === input.trailerId) {
    throw new InvalidTripError("Capul tractor și semiremorca nu pot fi același vehicul.");
  }

  for (const id of vehicleIds) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle || vehicle.companyId !== companyId) {
      throw new InvalidTripError("Vehiculul selectat nu aparține firmei tale.");
    }
    if (!vehicle.isActive) {
      throw new InvalidTripError(`Vehiculul ${vehicle.registrationNumber} este dezactivat.`);
    }
  }

  for (const id of driverIds) {
    const driver = await prisma.driver.findUnique({ where: { id } });
    if (!driver || driver.companyId !== companyId) {
      throw new InvalidTripError("Șoferul selectat nu aparține firmei tale.");
    }
    if (!driver.isActive) {
      throw new InvalidTripError(`Șoferul ${driver.lastName} ${driver.firstName} este dezactivat.`);
    }
  }
}

function assertDateRangeValid(startsAt: Date, endsAt: Date): void {
  if (endsAt.getTime() < startsAt.getTime()) {
    throw new InvalidTripError("Sfârșitul cursei nu poate fi înaintea începutului.");
  }
}

export async function createTrip(session: SessionUser, input: CreateTripInput) {
  assertCompanyAccess(session, input.companyId);
  assertDateRangeValid(input.startsAt, input.endsAt);
  await assertResourcesUsable(input.companyId, input);

  const year = currentOrderYear();

  for (let attempt = 0; attempt < MAX_TRIP_NUMBERING_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Transaction-scoped advisory lock, released on commit or rollback.
        // Serializes number allocation per (companyId, year) across every
        // connection, so concurrent callers queue instead of racing the
        // aggregate-then-insert below. Keyed on "trip:" so it cannot contend
        // with order numbering, which locks the same company and year.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trip:${input.companyId}:${year}`}))`;

        const highest = await tx.trip.aggregate({
          where: { companyId: input.companyId, year },
          _max: { sequence: true },
        });
        const sequence = (highest._max.sequence ?? 0) + 1;

        return tx.trip.create({
          data: {
            companyId: input.companyId,
            year,
            sequence,
            tripNumber: formatTripNumber(year, sequence),
            tractorUnitId: input.tractorUnitId ?? null,
            trailerId: input.trailerId ?? null,
            primaryDriverId: input.primaryDriverId ?? null,
            secondDriverId: input.secondDriverId ?? null,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            notes: input.notes ?? null,
          },
        });
      });
    } catch (error) {
      const isNumberCollision =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (isNumberCollision && attempt < MAX_TRIP_NUMBERING_ATTEMPTS - 1) continue;
      if (isNumberCollision) throw new TripNumberingError();

      // P2024 (pool wait timed out) and P2028 (transaction closed) are what
      // contention produces once the pool is saturated; without this they would
      // surface as raw English Prisma errors instead of the Romanian one.
      const isResourceExhaustion =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2024" || error.code === "P2028");
      if (isResourceExhaustion) throw new TripNumberingError();

      throw error;
    }
  }

  throw new TripNumberingError();
}
