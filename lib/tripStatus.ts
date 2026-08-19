import type { TripStatus } from "@/lib/generated/prisma/enums";

export class InvalidTripStatusTransitionError extends Error {
  constructor(from: TripStatus, to: TripStatus) {
    super(
      `Nu se poate trece cursa din "${TRIP_STATUS_LABELS[from]}" în "${TRIP_STATUS_LABELS[to]}".`
    );
    this.name = "InvalidTripStatusTransitionError";
  }
}

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  PLANNED: "Planificată",
  IN_PROGRESS: "În execuție",
  COMPLETED: "Încheiată",
  CANCELLED: "Anulată",
};

/** COMPLETED and CANCELLED are terminal: nothing leaves them. */
export const ALLOWED_TRIP_TRANSITIONS: Record<TripStatus, TripStatus[]> = {
  PLANNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * A finished or cancelled trip is a past fact. Changing what it carried would
 * rewrite the history the cost module will later read.
 */
export const TRIP_EDITABLE_STATUSES = ["PLANNED", "IN_PROGRESS"] as const satisfies readonly TripStatus[];

export function assertTripTransitionAllowed(from: TripStatus, to: TripStatus): void {
  if (!ALLOWED_TRIP_TRANSITIONS[from].includes(to)) {
    throw new InvalidTripStatusTransitionError(from, to);
  }
}

/** `C-` distinguishes a trip number from an order number at a glance — both are otherwise `YYYY-NNNN`. */
export function formatTripNumber(year: number, sequence: number): string {
  return `C-${year}-${String(sequence).padStart(4, "0")}`;
}

/**
 * Inclusive at both ends: trips that merely touch on one day still conflict,
 * because a vehicle cannot be in two places on the same calendar day. Both
 * columns are `@db.Date`, so Prisma hands them back at UTC midnight and a plain
 * timestamp comparison is exact.
 */
export function datesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() <= bEnd.getTime() && bStart.getTime() <= aEnd.getTime();
}
