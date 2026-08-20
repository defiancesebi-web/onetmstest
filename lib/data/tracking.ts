import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { toDateKey, todayKeyInBucharest } from "@/lib/documentStatus";
import type { TripStatus, StopType } from "@/lib/generated/prisma/enums";

/**
 * Read model for the tracking board. There is no GPS feed yet, so a truck's
 * position is *estimated* from how many of its stops fall before today's
 * Bucharest calendar day — never presented as a real coordinate. The page
 * labels it as an estimate for exactly this reason.
 */

export type TrackedStop = {
  type: StopType;
  city: string;
  country: string;
  dateKey: string;
  done: boolean;
};

export type TrackedTrip = {
  id: string;
  tripNumber: string;
  status: TripStatus;
  truck: string | null;
  trailer: string | null;
  driver: string | null;
  startKey: string;
  endKey: string;
  originCity: string | null;
  destinationCity: string | null;
  totalStops: number;
  doneStops: number;
  /** 0–100, estimated from stops already in the past. */
  progressPct: number;
  nextStop: TrackedStop | null;
  orderNumbers: string[];
};

export type TrackingBoard = {
  onRoad: number;
  waiting: number;
  idleTrucks: number;
  fleetSize: number;
  trips: TrackedTrip[];
  idle: { id: string; registrationNumber: string }[];
};

const ACTIVE_STATUSES: TripStatus[] = ["IN_PROGRESS", "PLANNED"];

export async function getTrackingBoard(
  session: SessionUser,
  companyId: string
): Promise<TrackingBoard> {
  assertCompanyAccess(session, companyId);

  const today = todayKeyInBucharest();

  const [rawTrips, tractors] = await Promise.all([
    prisma.trip.findMany({
      where: { companyId, status: { in: ACTIVE_STATUSES } },
      include: {
        tractorUnit: { select: { registrationNumber: true } },
        trailer: { select: { registrationNumber: true } },
        primaryDriver: { select: { firstName: true, lastName: true } },
        orders: {
          select: {
            orderNumber: true,
            stops: {
              select: { type: true, city: true, country: true, scheduledDate: true, sequence: true },
            },
          },
        },
      },
      orderBy: [{ status: "asc" }, { startsAt: "asc" }],
    }),
    prisma.vehicle.findMany({
      where: { companyId, isActive: true, type: { not: "SEMI_TRAILER" } },
      select: { id: true, registrationNumber: true },
      orderBy: { registrationNumber: "asc" },
    }),
  ]);

  const trips: TrackedTrip[] = rawTrips.map((trip) => {
    // Every stop of every attached order, in the order the driver runs them.
    const stops = trip.orders
      .flatMap((order) => order.stops)
      .sort(
        (a, b) =>
          a.scheduledDate.getTime() - b.scheduledDate.getTime() || a.sequence - b.sequence
      )
      .map((stop) => {
        const dateKey = toDateKey(stop.scheduledDate);
        return {
          type: stop.type,
          city: stop.city,
          country: stop.country,
          dateKey,
          // A stop strictly before today has been passed; today's is still "next".
          done: dateKey < today,
        };
      });

    const totalStops = stops.length;
    const doneStops = stops.filter((s) => s.done).length;
    const firstLoading = stops.find((s) => s.type === "LOADING") ?? stops[0] ?? null;
    const lastUnloading = [...stops].reverse().find((s) => s.type === "UNLOADING") ?? stops[stops.length - 1] ?? null;
    const nextStop = stops.find((s) => !s.done) ?? null;

    const progressPct =
      trip.status === "IN_PROGRESS" && totalStops > 0
        ? Math.round((doneStops / totalStops) * 100)
        : 0;

    return {
      id: trip.id,
      tripNumber: trip.tripNumber,
      status: trip.status,
      truck: trip.tractorUnit?.registrationNumber ?? null,
      trailer: trip.trailer?.registrationNumber ?? null,
      driver: trip.primaryDriver
        ? `${trip.primaryDriver.lastName} ${trip.primaryDriver.firstName}`
        : null,
      startKey: toDateKey(trip.startsAt),
      endKey: toDateKey(trip.endsAt),
      originCity: firstLoading?.city ?? null,
      destinationCity: lastUnloading?.city ?? null,
      totalStops,
      doneStops,
      progressPct,
      nextStop,
      orderNumbers: trip.orders.map((o) => o.orderNumber),
    };
  });

  const onRoad = trips.filter((t) => t.status === "IN_PROGRESS").length;
  const waiting = trips.filter((t) => t.status === "PLANNED").length;

  // A truck is "on the road" only for a trip already in progress.
  const busyTruckRegs = new Set(
    trips.filter((t) => t.status === "IN_PROGRESS" && t.truck).map((t) => t.truck)
  );
  const idle = tractors.filter((v) => !busyTruckRegs.has(v.registrationNumber));

  return {
    onRoad,
    waiting,
    idleTrucks: idle.length,
    fleetSize: tractors.length,
    trips,
    idle,
  };
}
