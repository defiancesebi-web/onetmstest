import { Prisma } from "@/lib/generated/prisma/client";
import type { TripStatus } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";
import {
  formatTripNumber,
  datesOverlap,
  TRIP_EDITABLE_STATUSES,
  assertTripTransitionAllowed,
} from "@/lib/tripStatus";
// Reused rather than duplicated: the helper is order-flavoured in name only —
// it returns the current calendar year in Europe/Bucharest, which is what trip
// numbering needs too.
import { currentOrderYear, OrderNotFoundError } from "@/lib/data/orders";

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
  // Deliberately no SUPER_ADMIN bypass here (unlike assertCompanyAccess): the
  // route guard already keeps SUPER_ADMIN out of every /dashboard route, and
  // the spec forbids that role from reaching any company's operational data,
  // so this stays a plain companyId match with nothing carved out.
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
 * A finished or cancelled trip is a past fact. Changing what it carried —
 * its resources, its dates, or the orders riding on it — would rewrite the
 * history the cost module will later read. Shared by every write below so
 * the guard and its message can't drift between them.
 */
function assertTripEditable(trip: { status: TripStatus }): void {
  if (!(TRIP_EDITABLE_STATUSES as readonly string[]).includes(trip.status)) {
    throw new InvalidTripError("Cursa este încheiată sau anulată și nu mai poate fi modificată.");
  }
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
  assertTripEditable(trip);

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
  const trip = await assertOwnTrip(session, tripId);
  assertTripEditable(trip);
  assertDateRangeValid(startsAt, endsAt);

  // Setting the flag is the point: from here on, attaching an order must not
  // silently overwrite what the dispatcher chose.
  return prisma.trip.update({
    where: { id: tripId },
    data: { startsAt, endsAt, datesEditedManually: true },
  });
}

export type UnplannedOrder = Prisma.OrderGetPayload<{
  include: { client: { select: { name: true } }; stops: true };
}>;

/**
 * Recomputes the trip's window from its orders' stops, unless the dispatcher
 * has taken the dates over by hand. Called inside the same transaction as the
 * attach/detach, so the window is never observed out of step with its orders.
 */
async function recalcTripDates(
  tx: Prisma.TransactionClient,
  tripId: string
): Promise<void> {
  const trip = await tx.trip.findUniqueOrThrow({ where: { id: tripId } });
  if (trip.datesEditedManually) return;

  const stops = await tx.orderStop.findMany({
    where: { order: { tripId } },
    select: { type: true, scheduledDate: true },
  });
  if (stops.length === 0) return;

  const loadings = stops.filter((s) => s.type === "LOADING").map((s) => s.scheduledDate.getTime());
  const unloadings = stops
    .filter((s) => s.type === "UNLOADING")
    .map((s) => s.scheduledDate.getTime());

  // Every order carries at least one of each, guaranteed by order creation, so
  // these arrays are non-empty whenever any stop exists.
  const startsAt = new Date(Math.min(...loadings));
  const endsAt = new Date(Math.max(...unloadings));

  await tx.trip.update({ where: { id: tripId }, data: { startsAt, endsAt } });
}

export async function attachOrderToTrip(
  session: SessionUser,
  tripId: string,
  orderId: string
): Promise<void> {
  const trip = await assertOwnTrip(session, tripId);
  assertTripEditable(trip);

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.companyId !== trip.companyId) {
    throw new InvalidTripError("Comanda selectată nu aparține firmei tale.");
  }
  if (order.status !== "CONFIRMED") {
    throw new InvalidTripError("Doar comenzile confirmate pot fi planificate.");
  }
  if (order.tripId) {
    throw new InvalidTripError("Comanda este deja atașată unei curse.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { tripId } });
    await recalcTripDates(tx, tripId);
  });
}

export async function detachOrderFromTrip(
  session: SessionUser,
  orderId: string
): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new OrderNotFoundError();
  assertCompanyAccess(session, order.companyId);

  const tripId = order.tripId;
  if (!tripId) return;

  // Mirrors the attach-side check: a completed or cancelled trip is a past
  // fact, and detaching an order from it would rewrite the history the cost
  // module will rest on.
  const trip = await assertOwnTrip(session, tripId);
  assertTripEditable(trip);

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { tripId: null } });
    await recalcTripDates(tx, tripId);
  });
}

export async function listUnplannedOrders(
  session: SessionUser,
  companyId: string
): Promise<UnplannedOrder[]> {
  assertCompanyAccess(session, companyId);

  return prisma.order.findMany({
    where: { companyId, tripId: null, status: "CONFIRMED" },
    include: { client: { select: { name: true } }, stops: { orderBy: { sequence: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Propagation only ever advances an order along its own path. `updateMany` with
 * a status filter is what enforces that: an order that has already moved past
 * the expected state simply does not match, so a completed trip cannot pull an
 * invoiced order back to delivered.
 */
export async function updateTripStatus(
  session: SessionUser,
  tripId: string,
  to: TripStatus
) {
  const trip = await assertOwnTrip(session, tripId);
  assertTripTransitionAllowed(trip.status, to);

  return prisma.$transaction(async (tx) => {
    if (to === "IN_PROGRESS") {
      await tx.order.updateMany({
        where: { tripId, status: "CONFIRMED" },
        data: { status: "IN_PROGRESS" },
      });
    }
    if (to === "COMPLETED") {
      await tx.order.updateMany({
        where: { tripId, status: "IN_PROGRESS" },
        data: { status: "DELIVERED" },
      });
    }
    if (to === "CANCELLED") {
      // The orders themselves are untouched — they go back to the unplanned
      // list and can be put on another truck.
      await tx.order.updateMany({ where: { tripId }, data: { tripId: null } });
    }

    return tx.trip.update({ where: { id: tripId }, data: { status: to } });
  });
}
