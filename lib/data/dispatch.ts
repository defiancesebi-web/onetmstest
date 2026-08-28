import { assertCompanyAccess, type SessionUser } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { listUnplannedOrders } from "@/lib/data/trips";
import { toDateKey } from "@/lib/documentStatus";
import type { TripStatus } from "@/lib/generated/prisma/enums";

/**
 * Read model for the dispatch calendar board (drivers/trucks/trailers × days).
 * A card is placed on the row of its assigned resource and spans the days its
 * trip covers inside the visible week. Cities come from the trip's orders'
 * stops (first LOADING → last UNLOADING), the same way the tracking board
 * derives origin/destination.
 */

export type DispatchView = "drivers" | "trucks" | "trailers";

export type DispatchRow = {
  key: string;
  label: string;
  sub?: string;
};

export type DispatchCard = {
  id: string;
  tripNumber: string;
  status: TripStatus;
  rowKey: string;
  startKey: string;
  endKey: string;
  originCity: string | null;
  destCity: string | null;
  orderNumbers: string[];
};

export type DispatchUnassigned = {
  id: string;
  orderNumber: string;
  clientName: string;
  originCity: string | null;
  destCity: string | null;
  dateKey: string | null;
};

export type DispatchBoard = {
  rows: DispatchRow[];
  cards: DispatchCard[];
  unassigned: DispatchUnassigned[];
};

const NONE = "__none__";

type StopLite = { city: string; type: string; sequence: number; scheduledDate: Date };

function endpoints(stops: StopLite[]): { origin: string | null; dest: string | null } {
  const sorted = [...stops].sort(
    (a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime() || a.sequence - b.sequence
  );
  const firstLoading = sorted.find((s) => s.type === "LOADING") ?? sorted[0] ?? null;
  const lastUnloading =
    [...sorted].reverse().find((s) => s.type === "UNLOADING") ?? sorted[sorted.length - 1] ?? null;
  return { origin: firstLoading?.city ?? null, dest: lastUnloading?.city ?? null };
}

export async function getDispatchBoard(
  session: SessionUser,
  companyId: string,
  opts: { view: DispatchView; weekStart: string; weekEnd: string }
): Promise<DispatchBoard> {
  assertCompanyAccess(session, companyId);

  const startDate = new Date(`${opts.weekStart}T00:00:00.000Z`);
  const endDate = new Date(`${opts.weekEnd}T23:59:59.999Z`);

  const [drivers, tractors, trailers, rawTrips, unplanned] = await Promise.all([
    opts.view === "drivers"
      ? prisma.driver.findMany({
          where: { companyId, isActive: true },
          select: { id: true, firstName: true, lastName: true },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        })
      : Promise.resolve([]),
    opts.view === "trucks"
      ? prisma.vehicle.findMany({
          where: { companyId, isActive: true, type: { not: "SEMI_TRAILER" } },
          select: { id: true, registrationNumber: true },
          orderBy: { registrationNumber: "asc" },
        })
      : Promise.resolve([]),
    opts.view === "trailers"
      ? prisma.vehicle.findMany({
          where: { companyId, isActive: true, type: "SEMI_TRAILER" },
          select: { id: true, registrationNumber: true },
          orderBy: { registrationNumber: "asc" },
        })
      : Promise.resolve([]),
    prisma.trip.findMany({
      where: { companyId, startsAt: { lte: endDate }, endsAt: { gte: startDate } },
      select: {
        id: true,
        tripNumber: true,
        status: true,
        startsAt: true,
        endsAt: true,
        primaryDriverId: true,
        tractorUnitId: true,
        trailerId: true,
        orders: {
          select: {
            orderNumber: true,
            stops: {
              select: { city: true, type: true, sequence: true, scheduledDate: true },
            },
          },
        },
      },
      orderBy: { startsAt: "asc" },
    }),
    listUnplannedOrders(session, companyId),
  ]);

  const rowKeyOf = (t: { primaryDriverId: string | null; tractorUnitId: string | null; trailerId: string | null }) =>
    opts.view === "drivers"
      ? t.primaryDriverId ?? NONE
      : opts.view === "trucks"
        ? t.tractorUnitId ?? NONE
        : t.trailerId ?? NONE;

  const cards: DispatchCard[] = rawTrips.map((t) => {
    const { origin, dest } = endpoints(t.orders.flatMap((o) => o.stops));
    return {
      id: t.id,
      tripNumber: t.tripNumber,
      status: t.status,
      rowKey: rowKeyOf(t),
      startKey: toDateKey(t.startsAt),
      endKey: toDateKey(t.endsAt),
      originCity: origin,
      destCity: dest,
      orderNumbers: t.orders.map((o) => o.orderNumber),
    };
  });

  // Base rows for the chosen view.
  let rows: DispatchRow[] =
    opts.view === "drivers"
      ? drivers.map((d) => ({ key: d.id, label: `${d.lastName} ${d.firstName}`.trim() }))
      : opts.view === "trucks"
        ? tractors.map((v) => ({ key: v.id, label: v.registrationNumber }))
        : trailers.map((v) => ({ key: v.id, label: v.registrationNumber }));

  // Append a catch-all row only if some card in view has no such resource.
  if (cards.some((c) => c.rowKey === NONE)) {
    rows = [...rows, { key: NONE, label: NONE }];
  }

  const unassigned: DispatchUnassigned[] = unplanned.map((o) => {
    const { origin, dest } = endpoints(o.stops);
    const firstDate = [...o.stops].sort(
      (a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime() || a.sequence - b.sequence
    )[0]?.scheduledDate;
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      clientName: o.client.name,
      originCity: origin,
      destCity: dest,
      dateKey: firstDate ? toDateKey(firstDate) : null,
    };
  });

  return { rows, cards, unassigned };
}
