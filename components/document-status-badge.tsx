import {
  OWNER_STATUS_LABELS,
  type OwnerDocumentStatus,
} from "@/lib/documentStatus";

const CLASSES: Record<OwnerDocumentStatus, string> = {
  EXPIRED: "bg-red-100 text-red-900 border-red-300",
  EXPIRING_SOON: "bg-amber-100 text-amber-900 border-amber-300",
  VALID: "bg-emerald-100 text-emerald-900 border-emerald-300",
  NO_DOCUMENTS: "bg-muted text-muted-foreground border-border",
};

export function DocumentStatusBadge({ status }: { status: OwnerDocumentStatus }) {
  return (
    <span
      className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${CLASSES[status]}`}
    >
      {OWNER_STATUS_LABELS[status]}
    </span>
  );
}
