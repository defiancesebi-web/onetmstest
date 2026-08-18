import Link from "next/link";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import {
  DOCUMENT_TYPE_LABELS,
  EXPIRY_WARNING_DAYS,
  formatDateKey,
  type DocumentStatus,
} from "@/lib/documentStatus";
import type { DocumentType } from "@/lib/generated/prisma/enums";

export type ExpiryAlertRow = {
  id: string;
  type: DocumentType;
  expiresAt: string;
  status: DocumentStatus;
  ownerLabel: string;
  ownerHref: string;
};

export function ExpiryAlerts({ rows }: { rows: ExpiryAlertRow[] }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-medium">Documente care expiră</h2>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
          Toate documentele sunt în regulă. Nimic nu expiră în următoarele{" "}
          {EXPIRY_WARNING_DAYS} de zile.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">Document</th>
                <th className="px-4 py-2 font-medium">Pentru</th>
                <th className="px-4 py-2 font-medium">Expiră</th>
                <th className="px-4 py-2 font-medium">Stare</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{DOCUMENT_TYPE_LABELS[row.type]}</td>
                  <td className="px-4 py-2">
                    <Link href={row.ownerHref} className="underline">
                      {row.ownerLabel}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{formatDateKey(row.expiresAt)}</td>
                  <td className="px-4 py-2">
                    <DocumentStatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
