import { orderStatusLabel } from "@/lib/labels";
import type { Locale } from "@/lib/i18n";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

const COLORS: Record<OrderStatus, string> = {
  NEW: "bg-slate-100 text-slate-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  DOCUMENTS_RECEIVED: "bg-teal-100 text-teal-700",
  INVOICED: "bg-violet-100 text-violet-700",
  CANCELLED: "bg-rose-100 text-rose-700",
};

export function OrderStatusPill({
  status,
  locale = "ro",
}: {
  status: OrderStatus;
  locale?: Locale;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${COLORS[status]}`}
    >
      {orderStatusLabel(status, locale)}
    </span>
  );
}

/** Hex colours matching the pills above, for the SVG donut segments. */
export const STATUS_HEX: Record<OrderStatus, string> = {
  NEW: "#94a3b8",
  CONFIRMED: "#2563eb",
  IN_PROGRESS: "#f59e0b",
  DELIVERED: "#16a34a",
  DOCUMENTS_RECEIVED: "#0d9488",
  INVOICED: "#8b5cf6",
  CANCELLED: "#ef4444",
};
