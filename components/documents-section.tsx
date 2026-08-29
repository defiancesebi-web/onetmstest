"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { formatDateKey, type DocumentStatus } from "@/lib/documentStatus";
import { documentTypeLabel } from "@/lib/labels";
import type { Locale } from "@/lib/i18n";
import type { DocumentType } from "@/lib/generated/prisma/enums";

export type DocsLabels = {
  heading: string;
  none: string;
  colType: string;
  colNumber: string;
  colExpires: string;
  colStatus: string;
  colActions: string;
  renew: string;
  delete: string;
  deleteConfirm: string;
  newExpiryAria: string;
  addHeading: string;
  docType: string;
  numberSeries: string;
  issuedAt: string;
  expiresAt: string;
  add: string;
  saving: string;
};
import {
  createDocumentAction,
  deleteDocumentAction,
  renewDocumentAction,
  type DocumentFormState,
} from "@/app/dashboard/documente/actions";

export type DocumentRow = {
  id: string;
  type: DocumentType;
  number: string | null;
  issuedAt: string | null;
  expiresAt: string;
  status: DocumentStatus;
};

/**
 * Renewal in place, one row at a time. Its own component so each row keeps its
 * own action state — a shared one would show another row's error.
 */
function DocumentRenewal({
  documentId,
  ownerPath,
  currentExpiry,
  labels,
}: {
  documentId: string;
  ownerPath: string;
  currentExpiry: string;
  labels: DocsLabels;
}) {
  const boundAction = renewDocumentAction.bind(null, documentId, ownerPath);
  const [state, formAction, pending] = useActionState<DocumentFormState, FormData>(boundAction, {
    error: null,
  });
  const [expiresAt, setExpiresAt] = useState(currentExpiry);

  return (
    <form action={formAction} className="flex items-center gap-1">
      <Input
        name="expiresAt"
        type="date"
        value={expiresAt}
        onChange={(e) => setExpiresAt(e.target.value)}
        required
        className="w-36"
        aria-label={labels.newExpiryAria}
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "..." : labels.renew}
      </Button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

export function DocumentsSection({
  ownerKind,
  ownerId,
  ownerPath,
  availableTypes,
  documents,
  locale,
  labels,
}: {
  ownerKind: "vehicle" | "driver";
  ownerId: string;
  ownerPath: string;
  availableTypes: readonly DocumentType[];
  documents: DocumentRow[];
  locale: Locale;
  labels: DocsLabels;
}) {
  const [state, formAction, pending] = useActionState<DocumentFormState, FormData>(
    createDocumentAction,
    { error: null }
  );

  // Controlled, so a rejected submit does not wipe what was typed.
  const [type, setType] = useState<DocumentType>(availableTypes[0]);
  const [number, setNumber] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  // React 19's post-action form reset touches the <select> DOM node directly.
  // Text/date inputs self-heal via their internal value tracker, but a <select>
  // does not, so a rejected submit can leave the dropdown showing the wrong
  // option even though `type` state itself is still correct. Resync it
  // explicitly whenever the action settles.
  const typeSelectRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (typeSelectRef.current) typeSelectRef.current.value = type;
  }, [state, type]);

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-sm font-medium">{labels.heading}</h2>

      {documents.length === 0 ? (
        <p className="text-muted-foreground mb-6 rounded-lg border border-dashed p-6 text-center text-sm">
          {labels.none}
        </p>
      ) : (
        <div className="mb-6 overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-4 py-2 font-medium">{labels.colType}</th>
                <th className="px-4 py-2 font-medium">{labels.colNumber}</th>
                <th className="px-4 py-2 font-medium">{labels.colExpires}</th>
                <th className="px-4 py-2 font-medium">{labels.colStatus}</th>
                <th className="px-4 py-2 font-medium">{labels.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{documentTypeLabel(document.type, locale)}</td>
                  <td className="text-muted-foreground px-4 py-2">{document.number ?? "—"}</td>
                  <td className="px-4 py-2">{formatDateKey(document.expiresAt)}</td>
                  <td className="px-4 py-2">
                    <DocumentStatusBadge status={document.status} locale={locale} />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <DocumentRenewal
                        documentId={document.id}
                        ownerPath={ownerPath}
                        currentExpiry={document.expiresAt}
                        labels={labels}
                      />
                      <form action={deleteDocumentAction.bind(null, document.id, ownerPath)}>
                        <Button
                          type="submit"
                          size="sm"
                          variant="destructive"
                          onClick={(event) => {
                            if (!window.confirm(labels.deleteConfirm)) event.preventDefault();
                          }}
                        >
                          {labels.delete}
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="mb-3 text-sm font-medium">{labels.addHeading}</h3>
      <form action={formAction} className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <input
          type="hidden"
          name={ownerKind === "vehicle" ? "vehicleId" : "driverId"}
          value={ownerId}
        />

        <div className="space-y-1.5">
          <Label htmlFor="documentType">{labels.docType}</Label>
          <select
            ref={typeSelectRef}
            id="documentType"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as DocumentType)}
            className="w-full select-native"
          >
            {availableTypes.map((value) => (
              <option key={value} value={value}>
                {documentTypeLabel(value, locale)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="number">{labels.numberSeries}</Label>
          <Input id="number" name="number" value={number} onChange={(e) => setNumber(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="issuedAt">{labels.issuedAt}</Label>
          <Input
            id="issuedAt"
            name="issuedAt"
            type="date"
            value={issuedAt}
            onChange={(e) => setIssuedAt(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expiresAt">{labels.expiresAt}</Label>
          <Input
            id="expiresAt"
            name="expiresAt"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            required
          />
        </div>

        {state.error && <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}

        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? labels.saving : labels.add}
          </Button>
        </div>
      </form>
    </section>
  );
}
