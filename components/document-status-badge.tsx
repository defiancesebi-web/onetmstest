import { type OwnerDocumentStatus } from "@/lib/documentStatus";
import { ownerDocStatusLabel } from "@/lib/labels";
import type { Locale } from "@/lib/i18n";

const CLASSES: Record<OwnerDocumentStatus, string> = {
  EXPIRED: "bg-red-100 text-red-700",
  EXPIRING_SOON: "bg-amber-100 text-amber-800",
  VALID: "bg-emerald-100 text-emerald-700",
  NO_DOCUMENTS: "bg-muted text-muted-foreground",
};

export function DocumentStatusBadge({
  status,
  locale = "ro",
}: {
  status: OwnerDocumentStatus;
  locale?: Locale;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${CLASSES[status]}`}
    >
      {ownerDocStatusLabel(status, locale)}
    </span>
  );
}
