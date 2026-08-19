import { Prisma } from "@/lib/generated/prisma/client";
import type { TripStatus } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";
import { formatTripNumber, datesOverlap } from "@/lib/tripStatus";
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
 *
 * Precondition: trusts the caller-supplied `companyId` as-is and does not call
 * `assertCompanyAccess` itself — every caller must validate the session against
 * that `companyId` before invoking this function.
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

export type TripListItem = Prisma.TripGetPayload<{
  include: {
    tractorUnit: { select: { registrationNumber: true } };
    trailer: { select: { registrationNumber: true } };
    primaryDriver: { select: { firstName: true; lastName: true } };
    secondDriver: { select: { firstName: true; lastName: true } };
    orders: { select: { id: true; orderNumber: true } };
  };
}>;

export type TripWithEverything = Prisma.TripGetPayload<{
  include: {
    tractorUnit: true;
    trailer: true;
    primaryDriver: true;
    secondDriver: true;
    orders: { include: { client: { select: { name: true } }; stops: true } };
  };
}>;

export type ConflictQuery = TripResourceInput & {
  startsAt: Date;
  endsAt: Date;
  excludeTripId?: string;
};

export type ResourceConflict = {
  tripId: string;
  tripNumber: string;
  resource: "tractorUnit" | "trailer" | "primaryDriver" | "secondDriver";
  resourceLabel: string;
};

const TRIP_LIST_INCLUDE = {
  tractorUnit: { select: { registrationNumber: true } },
  trailer: { select: { registrationNumber: true } },
  primaryDriver: { select: { firstName: true, lastName: true } },
  secondDriver: { select: { firstName: true, lastName: true } },
  orders: { select: { id: true, orderNumber: true } },
} as const;

export async function listTrips(
  session: SessionUser,
  companyId: string,
  options: { status?: TripStatus } = {}
): Promise<TripListItem[]> {
  assertCompanyAccess(session, companyId);

  return prisma.trip.findMany({
    where: { companyId, ...(options.status ? { status: options.status } : {}) },
    include: TRIP_LIST_INCLUDE,
    orderBy: [{ year: "desc" }, { sequence: "desc" }],
  });
}

export async function getTripById(
  session: SessionUser,
  tripId: string
): Promise<TripWithEverything | null> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      tractorUnit: true,
      trailer: true,
      primaryDriver: true,
      secondDriver: true,
      orders: { include: { client: { select: { name: true } }, stops: true } },
    },
  });
  if (!trip) return null;
  // Null rather than throw, so pages render 404 without revealing existence.
  if (trip.companyId !== session.companyId) return null;
  return trip;
}

async function assertOwnTrip(session: SessionUser, tripId: string) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw new TripNotFoundError();
  assertCompanyAccess(session, trip.companyId);
  return trip;
}

/**
 * Returns every clash rather than the first, so the dispatcher sees the whole
 * picture in one warning instead of fixing one and discovering the next.
 * A driver occupies the person in either seat, so both slots are checked
 * against both slots.
 */
export async function findResourceConflicts(
  session: SessionUser,
  companyId: string,
  input: ConflictQuery
): Promise<ResourceConflict[]> {
  assertCompanyAccess(session, companyId);

  const candidates = await prisma.trip.findMany({
    where: {
      companyId,
      status: { not: "CANCELLED" },
      ...(input.excludeTripId ? { id: { not: input.excludeTripId } } : {}),
    },
    include: TRIP_LIST_INCLUDE,
  });

  const conflicts: ResourceConflict[] = [];

  for (const trip of candidates) {
    if (!datesOverlap(input.startsAt, input.endsAt, trip.startsAt, trip.endsAt)) continue;

    if (input.tractorUnitId && trip.tractorUnitId === input.tractorUnitId) {
      conflicts.push({
        tripId: trip.id,
        tripNumber: trip.tripNumber,
        resource: "tractorUnit",
        resourceLabel: trip.tractorUnit?.registrationNumber ?? "vehicul",
      });
    }
    if (input.trailerId && trip.trailerId === input.trailerId) {
      conflicts.push({
        tripId: trip.id,
        tripNumber: trip.tripNumber,
        resource: "trailer",
        resourceLabel: trip.trailer?.registrationNumber ?? "semiremorcă",
      });
    }

    const busyDrivers = [trip.primaryDriverId, trip.secondDriverId].filter(Boolean);
    const driverLabel = (id: string) =>
      trip.primaryDriverId === id
        ? `${trip.primaryDriver?.lastName ?? ""} ${trip.primaryDriver?.firstName ?? ""}`.trim()
        : `${trip.secondDriver?.lastName ?? ""} ${trip.secondDriver?.firstName ?? ""}`.trim();

    if (input.primaryDriverId && busyDrivers.includes(input.primaryDriverId)) {
      conflicts.push({
        tripId: trip.id,
        tripNumber: trip.tripNumber,
        resource: "primaryDriver",
        resourceLabel: driverLabel(input.primaryDriverId) || "șofer",
      });
    }
    if (input.secondDriverId && busyDrivers.includes(input.secondDriverId)) {
      conflicts.push({
        tripId: trip.id,
        tripNumber: trip.tripNumber,
        resource: "secondDriver",
        resourceLabel: driverLabel(input.secondDriverId) || "șofer",
      });
    }
  }

  return conflicts;
}

export async function updateTripResources(
  session: SessionUser,
  tripId: string,
  input: TripResourceInput
) {
  const trip = await assertOwnTrip(session, tripId);

  // Only newly-assigned resources are validated. A truck sold after the trip was
  // planned must not make that trip uneditable — you still need to fix its dates
  // or swap the driver, and rejecting the unchanged truck would block everything.
  const changed: TripResourceInput = {
    tractorUnitId:
      input.tractorUnitId !== trip.tractorUnitId ? input.tractorUnitId : null,
    trailerId: input.trailerId !== trip.trailerId ? input.trailerId : null,
    primaryDriverId:
      input.primaryDriverId !== trip.primaryDriverId ? input.primaryDriverId : null,
    secondDriverId:
      input.secondDriverId !== trip.secondDriverId ? input.secondDriverId : null,
  };
  await assertResourcesUsable(trip.companyId, changed);

  return prisma.trip.update({
    where: { id: tripId },
    data: {
      tractorUnitId: input.tractorUnitId ?? null,
      trailerId: input.trailerId ?? null,
      primaryDriverId: input.primaryDriverId ?? null,
      secondDriverId: input.secondDriverId ?? null,
    },
  });
}

export async function updateTripDates(
  session: SessionUser,
  tripId: string,
  startsAt: Date,
  endsAt: Date
) {
  await assertOwnTrip(session, tripId);
  assertDateRangeValid(startsAt, endsAt);

  // Setting the flag is the point: from here on, attaching an order must not
  // silently overwrite what the dispatcher chose.
  return prisma.trip.update({
    where: { id: tripId },
    data: { startsAt, endsAt, datesEditedManually: true },
  });
}
