import { tripStatusLabel } from "@/lib/labels";
import type { Locale } from "@/lib/i18n";
import type { TripStatus } from "@/lib/generated/prisma/enums";

// Soft status pills matching the ONE TMS design: planned blue, in-progress
// amber, completed green, cancelled grey.
const CLASSES: Record<TripStatus, string> = {
  PLANNED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-600",
};

export function TripStatusBadge({
  status,
  locale = "ro",
}: {
  status: TripStatus;
  locale?: Locale;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${CLASSES[status]}`}
    >
      {tripStatusLabel(status, locale)}
    </span>
  );
}
