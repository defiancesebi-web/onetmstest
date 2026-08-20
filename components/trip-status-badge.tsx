import { TRIP_STATUS_LABELS } from "@/lib/tripStatus";
import type { TripStatus } from "@/lib/generated/prisma/enums";

// Flat, uppercase status pills in the Grilă (Swiss) style: semantic colour, no
// border, near-square corners. Colours match the approved design mock —
// planificată slate, în execuție blue, finalizată green, anulată grey.
const CLASSES: Record<TripStatus, string> = {
  PLANNED: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-muted text-muted-foreground",
};

export function TripStatusBadge({ status }: { status: TripStatus }) {
  return (
    <span
      className={`inline-block rounded-[2px] px-2 py-0.5 text-[10px] font-semibold tracking-[0.04em] uppercase ${CLASSES[status]}`}
    >
      {TRIP_STATUS_LABELS[status]}
    </span>
  );
}
