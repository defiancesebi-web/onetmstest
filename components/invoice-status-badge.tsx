import { invoiceStatusLabel } from "@/lib/labels";
import type { Locale } from "@/lib/i18n";
import type { InvoiceStatus } from "@/lib/generated/prisma/enums";

const TONE: Record<InvoiceStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  ISSUED: "bg-blue-100 text-blue-700",
  PAID: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-rose-100 text-rose-700",
};

export function InvoiceStatusBadge({
  status,
  locale = "ro",
}: {
  status: InvoiceStatus;
  locale?: Locale;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${TONE[status]}`}
    >
      {invoiceStatusLabel(status, locale)}
    </span>
  );
}
