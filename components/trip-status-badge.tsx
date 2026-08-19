import { TRIP_STATUS_LABELS } from "@/lib/tripStatus";
import type { TripStatus } from "@/lib/generated/prisma/enums";

const CLASSES: Record<TripStatus, string> = {
  PLANNED: "bg-sky-100 text-sky-900 border-sky-300",
  IN_PROGRESS: "bg-amber-100 text-amber-900 border-amber-300",
  COMPLETED: "bg-emerald-100 text-emerald-900 border-emerald-300",
  CANCELLED: "bg-muted text-muted-foreground border-border",
};

export function TripStatusBadge({ status }: { status: TripStatus }) {
  return (
    <span
      className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${CLASSES[status]}`}
    >
      {TRIP_STATUS_LABELS[status]}
    </span>
  );
}
